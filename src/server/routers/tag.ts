import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, workspaceProcedure } from '@/server/trpc';

export const tagRouter = router({
  /**
   * Add a tag to a page.
   */
  create: workspaceProcedure
    .input(
      z.object({
        pageId: z.string().uuid(),
        name: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the page belongs to this workspace
      const page = await ctx.db.page.findFirst({
        where: { id: input.pageId, workspaceId: ctx.workspaceId },
      });

      if (!page) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Page not found in this workspace.',
        });
      }

      // Check for duplicate tag on the same page
      const existing = await ctx.db.pageTag.findFirst({
        where: { pageId: input.pageId, name: input.name },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This tag already exists on this page.',
        });
      }

      return ctx.db.pageTag.create({
        data: { pageId: input.pageId, name: input.name },
      });
    }),

  /**
   * Remove a tag from a page.
   */
  remove: workspaceProcedure
    .input(
      z.object({
        pageId: z.string().uuid(),
        name: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the page belongs to this workspace
      const page = await ctx.db.page.findFirst({
        where: { id: input.pageId, workspaceId: ctx.workspaceId },
      });

      if (!page) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Page not found in this workspace.',
        });
      }

      const deleted = await ctx.db.pageTag.deleteMany({
        where: { pageId: input.pageId, name: input.name },
      });

      return { removed: deleted.count > 0 };
    }),

  /**
   * List all unique tags used across pages in the workspace.
   */
  list: workspaceProcedure.query(async ({ ctx }) => {
    const tags = await ctx.db.pageTag.groupBy({
      by: ['name'],
      where: { page: { workspaceId: ctx.workspaceId } },
      _count: { id: true },
      orderBy: { name: 'asc' },
    });

    return tags.map((tag) => ({
      name: tag.name,
      count: tag._count.id,
    }));
  }),

  /**
   * Rename a tag across all pages in the workspace.
   */
  rename: workspaceProcedure
    .input(
      z.object({
        oldName: z.string().min(1).max(100),
        newName: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.oldName === input.newName) {
        return { updated: 0 };
      }

      // Check if the new name already exists on any page that already has the old name
      // (would create a duplicate)
      const conflictPages = await ctx.db.pageTag.findMany({
        where: {
          page: { workspaceId: ctx.workspaceId },
          name: input.newName,
        },
        select: { pageId: true },
      });

      if (conflictPages.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `The tag "${input.newName}" already exists on ${conflictPages.length} page(s). Remove it first or choose a different name.`,
        });
      }

      const result = await ctx.db.pageTag.updateMany({
        where: {
          page: { workspaceId: ctx.workspaceId },
          name: input.oldName,
        },
        data: { name: input.newName },
      });

      return { updated: result.count };
    }),

  /**
   * Delete a tag from all pages in the workspace.
   */
  delete: workspaceProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.pageTag.deleteMany({
        where: {
          page: { workspaceId: ctx.workspaceId },
          name: input.name,
        },
      });

      return { deleted: result.count };
    }),
});