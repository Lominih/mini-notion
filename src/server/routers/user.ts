import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { hashPassword, comparePasswords } from "../auth";
import { TRPCError } from "@trpc/server";

export const userRouter = router({
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    return user;
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        image: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: input,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          updatedAt: true,
        },
      });
      return user;
    }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { password: true },
      });

      if (!user?.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No password set for this account",
        });
      }

      const valid = await comparePasswords(input.currentPassword, user.password);
      if (!valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Current password is incorrect",
        });
      }

      const hashed = await hashPassword(input.newPassword);
      await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { password: hashed },
      });

      return { success: true };
    }),

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    // Cascade cleanup: remove user's favorites, memberships, comments, and owned workspaces
    await ctx.prisma.$transaction([
      ctx.prisma.favorite.deleteMany({ where: { userId: ctx.userId } }),
      ctx.prisma.comment.deleteMany({ where: { authorId: ctx.userId } }),
      ctx.prisma.member.deleteMany({ where: { userId: ctx.userId } }),
      ctx.prisma.user.delete({ where: { id: ctx.userId } }),
    ]);
    return { success: true };
  }),
});

