import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, workspaceProcedure } from '@/server/trpc';
import { getNextOrder } from '@/server/services/page-tree';

export const templateRouter = router({
  /**
   * Save an existing page as a template.
   */
  create: workspaceProcedure
    .input(
      z.object({
        pageId: z.string().uuid(),
        name: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const page = await ctx.db.page.findFirst({
        where: { id: input.pageId, workspaceId: ctx.workspaceId },
      });

      if (!page) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Page not found in this workspace.',
        });
      }

      return ctx.db.template.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          icon: page.icon,
          content: page.content,
          workspaceId: ctx.workspaceId,
        },
      });
    }),

  /**
   * List all templates in the workspace.
   */
  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db.template.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }),

  /**
   * Create a new page from a template.
   */
  use: workspaceProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        title: z.string().min(1).max(500).default('Untitled'),
        parentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.template.findFirst({
        where: { id: input.templateId, workspaceId: ctx.workspaceId },
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found in this workspace.',
        });
      }

      // Validate parent if provided
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

      return ctx.db.page.create({
        data: {
          title: input.title,
          icon: template.icon,
          content: template.content,
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
    }),

  /**
   * Delete a template.
   */
  delete: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.template.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found in this workspace.',
        });
      }

      await ctx.db.template.delete({ where: { id: input.id } });

      return { deleted: true };
    }),
});