import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for auth service.
 * Tests password hashing, token generation, and user authentication.
 */

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async (pwd: string) => `hashed_${pwd}`),
    compare: vi.fn(async (plain: string, hashed: string) => hashed === `hashed_${plain}`),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn((_payload: unknown, _secret: string, opts: { expiresIn: string }) => {
      return `token_${opts.expiresIn}`;
    }),
    verify: vi.fn((token: string) => {
      if (token.startsWith("token_")) {
        return { userId: "user-1", email: "test@example.com" };
      }
      return null;
    }),
  },
}));

// Set env before importing
process.env.JWT_SECRET = "test-secret";

import {
  hashPassword,
  comparePasswords,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  createUser,
  authenticateUser,
} from "@/server/auth";
import { prisma } from "@/lib/prisma";

describe("auth service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hashPassword", () => {
    it("should hash a password", async () => {
      const hashed = await hashPassword("mypassword");
      expect(hashed).toBe("hashed_mypassword");
    });
  });

  describe("comparePasswords", () => {
    it("should return true for matching passwords", async () => {
      const hashed = "hashed_mypassword";
      const result = await comparePasswords("mypassword", hashed);
      expect(result).toBe(true);
    });

    it("should return false for non-matching passwords", async () => {
      const result = await comparePasswords("wrongpassword", "hashed_mypassword");
      expect(result).toBe(false);
    });
  });

  describe("generateTokens", () => {
    it("should generate access and refresh tokens", () => {
      const tokens = generateTokens({ userId: "user-1", email: "test@example.com" });
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(typeof tokens.accessToken).toBe("string");
      expect(typeof tokens.refreshToken).toBe("string");
    });
  });

  describe("verifyAccessToken", () => {
    it("should decode a valid token", () => {
      const payload = verifyAccessToken("token_24h");
      expect(payload).toEqual({ userId: "user-1", email: "test@example.com" });
    });

    it("should return null for an invalid token", () => {
      const payload = verifyAccessToken("invalid-token");
      expect(payload).toBeNull();
    });
  });

  describe("verifyRefreshToken", () => {
    it("should decode a valid refresh token", () => {
      const payload = verifyRefreshToken("token_7d");
      expect(payload).toEqual({ userId: "user-1", email: "test@example.com" });
    });

    it("should return null for an invalid token", () => {
      const payload = verifyRefreshToken("invalid");
      expect(payload).toBeNull();
    });
  });

  describe("createUser", () => {
    it("should create a new user with hashed password", async () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        name: "Test",
        image: null,
        createdAt: new Date(),
      };
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as never);

      const user = await createUser("test@example.com", "password123", "Test");

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: "test@example.com",
          password: "hashed_password123",
          name: "Test",
        },
        select: { id: true, email: true, name: true, image: true, createdAt: true },
      });
      expect(user).toEqual(mockUser);
    });
  });

  describe("authenticateUser", () => {
    it("should return user credentials for valid credentials", async () => {
      const mockDbUser = {
        id: "user-1",
        email: "test@example.com",
        name: "Test",
        image: null,
        password: "hashed_password123",
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as never);

      const result = await authenticateUser("test@example.com", "password123");

      expect(result).toEqual({
        id: "user-1",
        email: "test@example.com",
        name: "Test",
        image: null,
      });
    });

    it("should return null for non-existent user", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await authenticateUser("nobody@example.com", "password");
      expect(result).toBeNull();
    });

    it("should return null for wrong password", async () => {
      const mockDbUser = {
        id: "user-1",
        email: "test@example.com",
        name: "Test",
        image: null,
        password: "hashed_correct_password",
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as never);

      const result = await authenticateUser("test@example.com", "wrongpassword");
      expect(result).toBeNull();
    });

    it("should return null when user has no password", async () => {
      const mockDbUser = {
        id: "user-1",
        email: "test@example.com",
        name: "Test",
        image: null,
        password: null,
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as never);

      const result = await authenticateUser("test@example.com", "password");
      expect(result).toBeNull();
    });
  });
});
