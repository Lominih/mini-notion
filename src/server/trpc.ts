import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * tRPC context and router initialization.
 * Provides auth, Prisma, and procedure helpers.
 */

export interface Context {
  prisma: typeof prisma;
  db: typeof prisma;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  workspaceId: string;
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof z.ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

/**
 * Auth middleware ¡ª requires authenticated user and injects full user record.
 */
const authMiddleware = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }

  // Fetch full user record for context
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId! },
    select: { id: true, email: true, name: true, image: true },
  });

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found",
    });
  }

  return next({
    ctx: {
      user,
      userId: user.id,
      prisma,
      db: prisma,
    },
  });
});

/**
 * Protected procedure ¡ª requires authenticated user.
 */
export const protectedProcedure = t.procedure.use(authMiddleware);

/**
 * Workspace procedure ¡ª requires authenticated user and a valid workspace membership.
 * Workspace ID is extracted from the x-workspace-id header.
 */
const workspaceMiddleware = middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { id: true, email: true, name: true, image: true },
  });

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found",
    });
  }

  // workspaceId is injected by the HTTP handler from x-workspace-id header
  const workspaceId = "workspaceId" in ctx ? (ctx as { workspaceId: string }).workspaceId : undefined;

  if (!workspaceId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Workspace ID is required (set x-workspace-id header)",
    });
  }

  // Verify membership
  const membership = await prisma.member.findUnique({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId },
    },
  });

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this workspace",
    });
  }

  return next({
    ctx: {
      user,
      userId: user.id,
      workspaceId,
      prisma,
      db: prisma,
    },
  });
});

export const workspaceProcedure = t.procedure.use(workspaceMiddleware);
