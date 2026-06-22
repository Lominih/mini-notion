import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { MemberRole } from "@prisma/client";
import { isOwner } from "../services/permissions";

export const workspaceRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        icon: z.string().max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.create({
        data: {
          name: input.name,
          icon: input.icon,
          ownerId: ctx.userId,
          members: {
            create: {
              userId: ctx.userId,
              role: MemberRole.OWNER,
            },
          },
        },
        include: { members: true },
      });
      return workspace;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const member = await ctx.prisma.member.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.userId,
            workspaceId: input.id,
          },
        },
      });

      if (!member) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this workspace",
        });
      }

      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: input.id },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
          _count: { select: { pages: true } },
        },
      });

      return workspace;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        icon: z.string().max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.member.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.userId,
            workspaceId: input.id,
          },
        },
      });

      if (!member || !isOwner(member.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the workspace owner can update it",
        });
      }

      const { id, ...data } = input;
      const workspace = await ctx.prisma.workspace.update({
        where: { id },
        data,
      });

      return workspace;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.member.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.userId,
            workspaceId: input.id,
          },
        },
      });

      if (!member || !isOwner(member.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the workspace owner can delete it",
        });
      }

      await ctx.prisma.workspace.delete({ where: { id: input.id } });
      return { success: true };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.prisma.member.findMany({
      where: { userId: ctx.userId },
      include: {
        workspace: {
          include: {
            _count: { select: { members: true, pages: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return memberships.map((m) => ({
      ...m.workspace,
      role: m.role,
      memberCount: m.workspace._count.members,
      pageCount: m.workspace._count.pages,
    }));
  }),

  getCurrentWorkspace: protectedProcedure.query(async ({ ctx }) => {
    const membership = await ctx.prisma.member.findFirst({
      where: { userId: ctx.userId },
      include: {
        workspace: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, image: true },
                },
              },
            },
            _count: { select: { pages: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return membership
      ? { ...membership.workspace, role: membership.role }
      : null;
  }),
});

