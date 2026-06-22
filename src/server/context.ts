import { prisma } from "@/lib/prisma";
import { verifyAccessToken, JwtPayload } from "./auth";

export interface Context {
  prisma: typeof prisma;
  userId: string | null;
  user: JwtPayload | null;
  workspaceId: string | null;
}

export async function createContext(headers: Headers): Promise<Context> {
  const authHeader = headers.get("authorization");
  const cookieToken = headers.get("cookie")?.match(/access_token=([^;]+)/)?.[1];
  const token = authHeader?.replace("Bearer ", "") ?? cookieToken ?? null;

  let userId: string | null = null;
  let user: JwtPayload | null = null;

  if (token) {
    const decoded = verifyAccessToken(token);
    if (decoded) {
      userId = decoded.userId;
      user = decoded;
    }
  }

  const workspaceId = headers.get("x-workspace-id") ?? null;

  return { prisma, userId, user, workspaceId };
}
