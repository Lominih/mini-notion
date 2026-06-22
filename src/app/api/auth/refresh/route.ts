import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyRefreshToken, generateTokens } from "@/server/auth";
import { prisma } from "@/lib/prisma";

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { refreshToken } = refreshSchema.parse(body);

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return Response.json(
        { error: "Invalid or expired refresh token" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 401 });
    }

    const tokens = generateTokens({ userId: user.id, email: user.email });
    return Response.json(tokens);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}