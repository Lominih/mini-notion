import { z } from "zod";
import { prisma } from "@/server/db";
import { router, protectedProcedure } from "@/server/trpc";

/**
 * tRPC router for real-time page comments.
 * Supports create, list, update, delete, and resolve operations.
 */

const createCommentSchema = z.object({
  pageId: z.string().uuid(),
  content: z.string().min(1).max(10_000),
  blockId: z.string().uuid().optional(),
});

const listCommentsSchema = z.object({
  pageId: z.string().uuid(),
  includeResolved: z.boolean().default(false),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

const updateCommentSchema = z.object({
  commentId: z.string().uuid(),
  content: z.string().min(1).max(10_000),
});

const deleteCommentSchema = z.object({
  commentId: z.string().uuid(),
});

const resolveCommentSchema = z.object({
  commentId: z.string().uuid(),
  resolved: z.boolean(),
});

export const commentRouter = router({
  /**
   * Create a new comment on a page.
   * Optionally associates with a specific content block.
   */
  create: protectedProcedure
    .input(createCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const { pageId, content, blockId } = input;

      // Verify page exists and user has workspace access
      const page = await prisma.page.findUnique({ where: { id: pageId } });
      if (!page) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
      }

      const membership = await prisma.member.findUnique({
        where: {
          userId_workspaceId: { userId: ctx.user.id, workspaceId: page.workspaceId },
        },
      });
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this workspace" });
      }

      const comment = await prisma.comment.create({
        data: {
          pageId,
          authorId: ctx.user.id,
          content,
          blockId: blockId ?? null,
        },
        include: {
          author: {
            select: { id: true, name: true, image: true },
          },
        },
      });

      return comment;
    }),

  /**
   * List comments for a page.
   * Supports pagination via cursor and optional inclusion of resolved comments.
   */
  list: protectedProcedure
    .input(listCommentsSchema)
    .query(async ({ ctx, input }) => {
      const { pageId, includeResolved, limit, cursor } = input;

      // Verify workspace access
      const page = await prisma.page.findUnique({ where: { id: pageId }, select: { workspaceId: true } });
      if (!page) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
      }
      const membership = await prisma.member.findUnique({
        where: {
          userId_workspaceId: { userId: ctx.user.id, workspaceId: page.workspaceId },
        },
      });
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this workspace" });
      }

      const where = {
        pageId,
        ...(includeResolved ? {} : { resolved: false }),
      };

      const comments = await prisma.comment.findMany({
        where,
        orderBy: { createdAt: "asc" },
        take: limit + 1, // fetch one extra to detect "next page"
        ...(cursor
          ? {
              cursor: { id: cursor },
              skip: 1,
            }
          : {}),
        include: {
          author: {
            select: { id: true, name: true, image: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (comments.length > limit) {
        const next = comments.pop();
        nextCursor = next?.id;
      }

      return {
        comments,
        nextCursor,
      };
    }),

  /**
   * Get a single comment by ID.
   */
  getById: protectedProcedure
    .input(z.object({ commentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const comment = await prisma.comment.findUnique({
        where: { id: input.commentId },
        include: {
          author: {
            select: { id: true, name: true, image: true },
          },
          page: {
            select: { workspaceId: true },
          },
        },
      });

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }

      // Verify workspace access
      const membership = await prisma.member.findUnique({
        where: {
          userId_workspaceId: { userId: ctx.user.id, workspaceId: comment.page.workspaceId },
        },
      });
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this workspace" });
      }

      return comment;
    }),

  /**
   * Update a comment's content.
   * Only the author can update their own comment.
   */
  update: protectedProcedure
    .input(updateCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const { commentId, content } = input;

      const existing = await prisma.comment.findUnique({
        where: { id: commentId },
        include: { page: { select: { workspaceId: true } } },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }

      // Verify workspace access
      const membership = await prisma.member.findUnique({
        where: {
          userId_workspaceId: { userId: ctx.user.id, workspaceId: existing.page.workspaceId },
        },
      });
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this workspace" });
      }

      if (existing.authorId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own comments" });
      }

      const comment = await prisma.comment.update({
        where: { id: commentId },
        data: { content },
        include: {
          author: {
            select: { id: true, name: true, image: true },
          },
        },
      });

      return comment;
    }),

  /**
   * Delete a comment.
   * Only the author or a workspace admin can delete.
   */
  delete: protectedProcedure
    .input(deleteCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const { commentId } = input;

      const existing = await prisma.comment.findUnique({
        where: { id: commentId },
        include: {
          page: {
            select: { workspaceId: true },
          },
        },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }

      // Check if user is author or workspace admin
      const isAuthor = existing.authorId === ctx.user.id;
      if (!isAuthor) {
        const membership = await prisma.member.findUnique({
          where: {
            userId_workspaceId: {
              userId: ctx.user.id,
              workspaceId: existing.page.workspaceId,
            },
          },
        });

        if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to delete this comment" });
        }
      }

      await prisma.comment.delete({ where: { id: commentId } });

      return { success: true, id: commentId };
    }),

  /**
   * Mark a comment as resolved or unresolved.
   */
  resolve: protectedProcedure
    .input(resolveCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const { commentId, resolved } = input;

      const existing = await prisma.comment.findUnique({
        where: { id: commentId },
        include: { page: { select: { workspaceId: true } } },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }

      // Verify workspace access
      const membership = await prisma.member.findUnique({
        where: {
          userId_workspaceId: { userId: ctx.user.id, workspaceId: existing.page.workspaceId },
        },
      });
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this workspace" });
      }

      const comment = await prisma.comment.update({
        where: { id: commentId },
        data: { resolved },
        include: {
          author: {
            select: { id: true, name: true, image: true },
          },
        },
      });

      return comment;
    }),

  /**
   * Count unresolved comments for a page.
   */
  unresolvedCount: protectedProcedure
    .input(z.object({ pageId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify workspace access
      const page = await prisma.page.findUnique({ where: { id: input.pageId }, select: { workspaceId: true } });
      if (!page) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
      }
      const membership = await prisma.member.findUnique({
        where: {
          userId_workspaceId: { userId: ctx.user.id, workspaceId: page.workspaceId },
        },
      });
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this workspace" });
      }

      const count = await prisma.comment.count({
        where: {
          pageId: input.pageId,
          resolved: false,
        },
      });

      return { count };
    }),
});