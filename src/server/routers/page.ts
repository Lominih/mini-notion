import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, workspaceProcedure } from '@/server/trpc';
import {
  getPageTree,
  getDescendants,
  wouldCreateCycle,
  getNextOrder,
  invalidatePageTreeCache,
} from '@/server/services/page-tree';
import { searchPages } from '@/server/services/search';
import { listFavorites } from '@/server/services/favorites';
import { listVersions } from '@/server/services/version-history';

const MAX_TITLE_LENGTH = 255;
const MAX_CONTENT_LENGTH = 1_048_576; // 1 MB

export const pageRouter = router({
  /**
   * Create a new page in a workspace, optionally nested under a parent.
   */
  create: workspaceProcedure
    .input(
      z.object({
        title: z.string().min(1).max(MAX_TITLE_LENGTH).default('Untitled'),
        icon: z.string().nullable().optional(),
        content: z.string().max(MAX_CONTENT_LENGTH).optional().default('[]'),
        parentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.parentId) {
        const parent = await ctx.db.page.findFirst({
          where: { id: input.parentId, workspaceId: ctx.workspaceId },
        });

        if (!parent) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Parent page not found in this workspace.',
          });
        }
      }

      const order = await getNextOrder(input.parentId ?? null, ctx.workspaceId);

      const result = await ctx.db.page.create({
        data: {
          title: input.title,
          icon: input.icon ?? null,
          content: input.content ?? '[]',
          workspaceId: ctx.workspaceId,
          parentId: input.parentId ?? null,
          order,
        },
        include: {
          tags: true,
          parent: { select: { id: true, title: true, icon: true } },
          children: { select: { id: true, title: true, icon: true } },
        },
      });

      invalidatePageTreeCache(ctx.workspaceId);
      return result;
    }),

  /**
   * Get a single page by ID with tags, parent, and children.
   */
  getById: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const page = await ctx.db.page.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          tags: true,
          parent: { select: { id: true, title: true, icon: true } },
          children: {
            select: { id: true, title: true, icon: true, order: true },
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!page) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Page not found.' });
      }

      return page;
    }),

  /**
   * Update page title, icon, and/or content.
   */
  update: workspaceProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(MAX_TITLE_LENGTH).optional(),
        icon: z.string().nullable().optional(),
        content: z.string().max(MAX_CONTENT_LENGTH).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.page.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Page not found.' });
      }

      const data: Record<string, unknown> = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.icon !== undefined) data.icon = input.icon;
      if (input.content !== undefined) data.content = input.content;

      const result = await ctx.db.page.update({
        where: { id: input.id },
        data,
        include: {
          tags: true,
          parent: { select: { id: true, title: true, icon: true } },
          children: { select: { id: true, title: true, icon: true } },
        },
      });

      invalidatePageTreeCache(ctx.workspaceId);
      return result;
    }),

  /**
   * Delete a page and all its descendants (cascade).
   */
  delete: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.page.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Page not found.' });
      }

      const descendantIds = await getDescendants(input.id);
      const allIds = [input.id, ...descendantIds];

      await ctx.db.$transaction([
        ctx.db.pageTag.deleteMany({ where: { pageId: { in: allIds } } }),
        ctx.db.comment.deleteMany({ where: { pageId: { in: allIds } } }),
        ctx.db.pageVersion.deleteMany({ where: { pageId: { in: allIds } } }),
        ctx.db.favorite.deleteMany({ where: { pageId: { in: allIds } } }),
        ctx.db.page.deleteMany({ where: { id: { in: allIds } } }),
      ]);

      invalidatePageTreeCache(ctx.workspaceId);
      return { deletedIds: allIds };
    }),

  /**
   * List pages in a workspace with optional parent filter.
   */
  list: workspaceProcedure
    .input(
      z
        .object({
          parentId: z.string().uuid().nullable().optional(),
          limit: z.number().min(1).max(200).default(50),
          cursor: z.string().uuid().nullable().optional(),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { workspaceId: ctx.workspaceId };

      if (input.parentId !== undefined) {
        where.parentId = input.parentId;
      }

      if (input.cursor) {
        const cursorPage = await ctx.db.page.findUnique({
          where: { id: input.cursor },
          select: { order: true },
        });
        if (cursorPage) {
          where.order = { gt: cursorPage.order };
        }
      }

      const pages = await ctx.db.page.findMany({
        where,
        take: input.limit + 1,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        include: {
          tags: { select: { id: true, name: true } },
          _count: { select: { children: true } },
        },
      });

      let nextCursor: string | null = null;
      if (pages.length > input.limit) {
        const nextItem = pages.pop()!;
        nextCursor = nextItem.id;
      }

      return { pages, nextCursor };
    }),

  /**
   * Move a page to a different parent (drag-and-drop reordering).
   */
  move: workspaceProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        newParentId: z.string().uuid().nullable(),
        order: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.page.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Page not found.' });
      }

      // Validate the new parent exists (if not null)
      if (input.newParentId) {
        const newParent = await ctx.db.page.findFirst({
          where: { id: input.newParentId, workspaceId: ctx.workspaceId },
        });

        if (!newParent) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Target parent page not found.',
          });
        }
      }

      // Prevent moving a page under itself or creating a cycle
      if (input.newParentId) {
        const cycle = await wouldCreateCycle(input.id, input.newParentId);
        if (cycle) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot move a page under one of its own descendants.',
          });
        }
      }

      let newOrder = input.order;
      if (newOrder === undefined) {
        newOrder = await getNextOrder(input.newParentId, ctx.workspaceId);
      }

      const result = await ctx.db.page.update({
        where: { id: input.id },
        data: { parentId: input.newParentId, order: newOrder },
      });

      invalidatePageTreeCache(ctx.workspaceId);
      return result;
    }),

  /**
   * Duplicate a page with all its content and nested children.
   */
  duplicate: workspaceProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(MAX_TITLE_LENGTH).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.page.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: { tags: true },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Page not found.' });
      }

      const newPage = await duplicateSubtree(ctx.db, existing, existing.parentId, input.title);
      invalidatePageTreeCache(ctx.workspaceId);
      return newPage;
    }),

  /**
   * Get the full page tree structure for the sidebar.
   */
  getTree: workspaceProcedure.query(async ({ ctx }) => {
    return getPageTree(ctx.workspaceId);
  }),

  /**
   * Full-text search across page titles and content.
   */
  search: workspaceProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        tags: z.array(z.string()).optional(),
        createdAfter: z.date().optional(),
        createdBefore: z.date().optional(),
        updatedAfter: z.date().optional(),
        updatedBefore: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const results = await searchPages({
        workspaceId: ctx.workspaceId,
        ...input,
      });

      return results.map((r) => ({
        ...r.page,
        score: r.score,
        matchedTitle: r.matchedTitle,
        matchedContent: r.matchedContent,
        highlights: r.highlights,
      }));
    }),

  /**
   * Get recently edited pages in the workspace.
   */
  getRecent: workspaceProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }).default({}))
    .query(async ({ ctx, input }) => {
      return ctx.db.page.findMany({
        where: { workspaceId: ctx.workspaceId },
        orderBy: { updatedAt: 'desc' },
        take: input.limit,
        include: { tags: { select: { id: true, name: true } } },
      });
    }),

  /**
   * Get the user's favorited pages in this workspace.
   */
  getFavorites: workspaceProcedure.query(async ({ ctx }) => {
    return listFavorites(ctx.userId, ctx.workspaceId);
  }),

  /**
   * Toggle a page's favorite status for the current user.
   */
  toggleFavorite: workspaceProcedure
    .input(z.object({ pageId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const page = await ctx.db.page.findFirst({
        where: { id: input.pageId, workspaceId: ctx.workspaceId },
      });

      if (!page) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Page not found.' });
      }

      const existing = await ctx.db.favorite.findUnique({
        where: {
          userId_pageId: { userId: ctx.userId, pageId: input.pageId },
        },
      });

      if (existing) {
        await ctx.db.favorite.delete({ where: { id: existing.id } });
        return { isFavorited: false };
      }

      await ctx.db.favorite.create({
        data: { userId: ctx.userId, pageId: input.pageId },
      });

      return { isFavorited: true };
    }),

  /**
   * List version history for a page with pagination.
   */
  listVersions: workspaceProcedure
    .input(
      z.object({
        pageId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const page = await ctx.db.page.findFirst({
        where: { id: input.pageId, workspaceId: ctx.workspaceId },
      });

      if (!page) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Page not found.' });
      }

      return listVersions({
        pageId: input.pageId,
        limit: input.limit,
        offset: input.offset,
      });
    }),
});

// ---- Helpers ----

interface DuplicateSource {
  id: string;
  title: string;
  icon: string | null;
  content: string;
  workspaceId: string;
  tags: { name: string }[];
}

/**
 * Recursively duplicate a page and its entire subtree under a new parent.
 */
async function duplicateSubtree(
  db: { page: typeof import('@/server/db').db.page; pageTag: typeof import('@/server/db').db.pageTag },
  source: DuplicateSource,
  newParentId: string | null,
  newTitle?: string,
) {
  const order = await getNextOrder(newParentId, source.workspaceId);

  const newPage = await db.page.create({
    data: {
      title: newTitle ?? `${source.title} (Copy)`,
      icon: source.icon,
      content: source.content,
      workspaceId: source.workspaceId,
      parentId: newParentId,
      order,
    },
  });

  // Copy tags
  if (source.tags.length > 0) {
    await db.pageTag.createMany({
      data: source.tags.map((tag) => ({ pageId: newPage.id, name: tag.name })),
    });
  }

  // Recursively duplicate children, reparenting them under the new page
  const children = await db.page.findMany({
    where: { parentId: source.id },
    include: { tags: true },
    orderBy: { order: 'asc' },
  });

  for (const child of children) {
    await duplicateSubtree(db, child, newPage.id);
  }

  return newPage;
}
