import { NextRequest } from "next/server";
import { z } from "zod";
import { createUser, generateTokens } from "@/server/auth";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = registerSchema.parse(body);

    const user = await createUser(data.email, data.password, data.name);
    const tokens = generateTokens({ userId: user.id, email: user.email });

    return Response.json({ user, ...tokens }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    const message = (error as Error).message;
    if (message.includes("Unique constraint")) {
      return Response.json(
        { error: "Email already in use" },
        { status: 409 }
      );
    }

    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}