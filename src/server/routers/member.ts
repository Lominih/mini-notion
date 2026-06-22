import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { MemberRole } from "@prisma/client";
import { canInvite, roleAtLeast } from "../services/permissions";
import { randomUUID } from "crypto";

export const memberRouter = router({
  invite: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const callerMember = await ctx.prisma.member.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.userId,
            workspaceId: input.workspaceId,
          },
        },
      });

      if (!callerMember || !canInvite(callerMember.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to invite members",
        });
      }

      const existingMember = await ctx.prisma.member.findFirst({
        where: {
          workspaceId: input.workspaceId,
          user: { email: input.email },
        },
      });

      if (existingMember) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a member of this workspace",
        });
      }

      const existingInvite = await ctx.prisma.invitation.findUnique({
        where: {
          email_workspaceId: {
            email: input.email,
            workspaceId: input.workspaceId,
          },
        },
      });

      if (existingInvite && existingInvite.expiresAt > new Date()) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An active invitation already exists for this email",
        });
      }

      if (existingInvite) {
        await ctx.prisma.invitation.delete({
          where: { id: existingInvite.id },
        });
      }

      const invitation = await ctx.prisma.invitation.create({
        data: {
          email: input.email,
          role: input.role as MemberRole,
          workspaceId: input.workspaceId,
          token: randomUUID(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return invitation;
    }),

  remove: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const callerMember = await ctx.prisma.member.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.userId,
            workspaceId: input.workspaceId,
          },
        },
      });

      if (!callerMember) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
      }

      const targetMember = await ctx.prisma.member.findUnique({
        where: {
          userId_workspaceId: {
            userId: input.userId,
            workspaceId: input.workspaceId,
          },
        },
      });

      if (!targetMember) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      if (targetMember.role === "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot remove the workspace owner",
        });
      }

      if (
        input.userId !== ctx.userId &&
        !roleAtLeast(callerMember.role, "ADMIN")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can remove other members",
        });
      }

      await ctx.prisma.member.delete({
        where: {
          userId_workspaceId: {
            userId: input.userId,
            workspaceId: input.workspaceId,
          },
        },
      });

      return { success: true };
    }),

  updateRole: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const callerMember = await ctx.prisma.member.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.userId,
            workspaceId: input.workspaceId,
          },
        },
      });

      if (!callerMember || !roleAtLeast(callerMember.role, "ADMIN")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can update member roles",
        });
      }

      const targetMember = await ctx.prisma.member.findUnique({
        where: {
          userId_workspaceId: {
            userId: input.userId,
            workspaceId: input.workspaceId,
          },
        },
      });

      if (!targetMember) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      if (targetMember.role === "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot change the owner's role",
        });
      }

      const member = await ctx.prisma.member.update({
        where: {
          userId_workspaceId: {
            userId: input.userId,
            workspaceId: input.workspaceId,
          },
        },
        data: { role: input.role as MemberRole },
      });

      return member;
    }),

  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const callerMember = await ctx.prisma.member.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.userId,
            workspaceId: input.workspaceId,
          },
        },
      });

      if (!callerMember) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
      }

      const members = await ctx.prisma.member.findMany({
        where: { workspaceId: input.workspaceId },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return members;
    }),

  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.prisma.invitation.findUnique({
        where: { token: input.token },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      if (invitation.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation has expired",
        });
      }

      if (invitation.email !== ctx.user.email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invitation is not for your email address",
        });
      }

      const existingMember = await ctx.prisma.member.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.userId,
            workspaceId: invitation.workspaceId,
          },
        },
      });

      if (existingMember) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You are already a member of this workspace",
        });
      }

      const member = await ctx.prisma.$transaction([
        ctx.prisma.member.create({
          data: {
            userId: ctx.userId,
            workspaceId: invitation.workspaceId,
            role: invitation.role,
          },
        }),
        ctx.prisma.invitation.delete({ where: { id: invitation.id } }),
      ]);

      return member[0];
    }),
});
