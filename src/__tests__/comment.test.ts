import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

(globalThis as any).TRPCError = TRPCError;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    member: { findUnique: vi.fn() },
    page: { findUnique: vi.fn() },
    comment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { commentRouter } from "@/server/routers/comment";
import { prisma } from "@/lib/prisma";

const PAGE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMMENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BLOCK_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_USER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  image: null,
};

const mockCtx = {
  prisma,
  db: prisma,
  userId: "user-1",
  user: mockUser,
  workspaceId: "ws-1",
};

describe("comment router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
  });

  describe("create", () => {
    it("should create a comment on a page", async () => {
      vi.mocked(prisma.page.findUnique).mockResolvedValue({
        id: PAGE_ID, workspaceId: "ws-1",
      } as never);
      vi.mocked(prisma.member.findUnique).mockResolvedValue({
        userId: "user-1", workspaceId: "ws-1", role: "MEMBER",
      } as never);
      vi.mocked(prisma.comment.create).mockResolvedValue({
        id: COMMENT_ID, pageId: PAGE_ID, authorId: "user-1",
        content: "Nice work!", blockId: null, resolved: false,
        createdAt: new Date(), author: mockUser,
      } as never);

      const caller = commentRouter.createCaller(mockCtx);
      const result = await caller.create({ pageId: PAGE_ID, content: "Nice work!" });

      expect(result.id).toBe(COMMENT_ID);
      expect(result.content).toBe("Nice work!");
      expect(prisma.comment.create).toHaveBeenCalledOnce();
    });

    it("should throw NOT_FOUND when page does not exist", async () => {
      vi.mocked(prisma.page.findUnique).mockResolvedValue(null);

      const caller = commentRouter.createCaller(mockCtx);
      await expect(
        caller.create({ pageId: PAGE_ID, content: "Hi" }),
      ).rejects.toThrow("Page not found");
    });

    it("should throw FORBIDDEN when user is not a workspace member", async () => {
      vi.mocked(prisma.page.findUnique).mockResolvedValue({
        id: PAGE_ID, workspaceId: "ws-1",
      } as never);
      vi.mocked(prisma.member.findUnique).mockResolvedValue(null);

      const caller = commentRouter.createCaller(mockCtx);
      await expect(
        caller.create({ pageId: PAGE_ID, content: "Hi" }),
      ).rejects.toThrow("Not a member of this workspace");
    });

    it("should associate comment with a blockId when provided", async () => {
      vi.mocked(prisma.page.findUnique).mockResolvedValue({
        id: PAGE_ID, workspaceId: "ws-1",
      } as never);
      vi.mocked(prisma.member.findUnique).mockResolvedValue({
        userId: "user-1", workspaceId: "ws-1", role: "MEMBER",
      } as never);
      vi.mocked(prisma.comment.create).mockResolvedValue({
        id: COMMENT_ID, pageId: PAGE_ID, authorId: "user-1",
        content: "Block comment", blockId: BLOCK_ID, resolved: false,
        createdAt: new Date(), author: mockUser,
      } as never);

      const caller = commentRouter.createCaller(mockCtx);
      await caller.create({ pageId: PAGE_ID, content: "Block comment", blockId: BLOCK_ID });

      const createCall = vi.mocked(prisma.comment.create).mock.calls[0][0];
      expect(createCall.data.blockId).toBe(BLOCK_ID);
    });
  });

  describe("list", () => {
    it("should list comments for a page", async () => {
      vi.mocked(prisma.page.findUnique).mockResolvedValue({
        id: PAGE_ID, workspaceId: "ws-1",
      } as never);
      vi.mocked(prisma.member.findUnique).mockResolvedValue({
        userId: "user-1", workspaceId: "ws-1", role: "MEMBER",
      } as never);
      vi.mocked(prisma.comment.findMany).mockResolvedValue([
        {
          id: COMMENT_ID, pageId: PAGE_ID, authorId: "user-1",
          content: "Comment 1", resolved: false, createdAt: new Date(), author: mockUser,
        },
      ] as never);

      const caller = commentRouter.createCaller(mockCtx);
      const result = await caller.list({ pageId: PAGE_ID });

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].content).toBe("Comment 1");
      expect(result.nextCursor).toBeUndefined();
    });

    it("should filter out resolved comments by default", async () => {
      vi.mocked(prisma.page.findUnique).mockResolvedValue({
        id: PAGE_ID, workspaceId: "ws-1",
      } as never);
      vi.mocked(prisma.member.findUnique).mockResolvedValue({
        userId: "user-1", workspaceId: "ws-1", role: "MEMBER",
      } as never);
      vi.mocked(prisma.comment.findMany).mockResolvedValue([]);

      const caller = commentRouter.createCaller(mockCtx);
      await caller.list({ pageId: PAGE_ID });

      const findManyCall = vi.mocked(prisma.comment.findMany).mock.calls[0][0];
      expect(findManyCall.where).toHaveProperty("resolved", false);
    });

    it("should include resolved comments when requested", async () => {
      vi.mocked(prisma.page.findUnique).mockResolvedValue({
        id: PAGE_ID, workspaceId: "ws-1",
      } as never);
      vi.mocked(prisma.member.findUnique).mockResolvedValue({
        userId: "user-1", workspaceId: "ws-1", role: "MEMBER",
      } as never);
      vi.mocked(prisma.comment.findMany).mockResolvedValue([]);

      const caller = commentRouter.createCaller(mockCtx);
      await caller.list({ pageId: PAGE_ID, includeResolved: true });

      const findManyCall = vi.mocked(prisma.comment.findMany).mock.calls[0][0];
      expect(findManyCall.where).not.toHaveProperty("resolved");
    });
  });

  describe("getById", () => {
    it("should return a comment by ID", async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        id: COMMENT_ID, pageId: PAGE_ID, authorId: "user-1", content: "Hello",
        resolved: false, createdAt: new Date(), author: mockUser,
        page: { workspaceId: "ws-1" },
      } as never);
      vi.mocked(prisma.member.findUnique).mockResolvedValue({
        userId: "user-1", workspaceId: "ws-1", role: "MEMBER",
      } as never);

      const caller = commentRouter.createCaller(mockCtx);
      const result = await caller.getById({ commentId: COMMENT_ID });
      expect(result.id).toBe(COMMENT_ID);
    });

    it("should throw NOT_FOUND for nonexistent comment", async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(null);

      const caller = commentRouter.createCaller(mockCtx);
      await expect(
        caller.getById({ commentId: COMMENT_ID }),
      ).rejects.toThrow("Comment not found");
    });
  });

  describe("update", () => {
    it("should update own comment", async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        id: COMMENT_ID, pageId: PAGE_ID, authorId: "user-1", content: "Old",
        resolved: false, createdAt: new Date(), page: { workspaceId: "ws-1" },
      } as never);
      vi.mocked(prisma.member.findUnique).mockResolvedValue({
        userId: "user-1", workspaceId: "ws-1", role: "MEMBER",
      } as never);
      vi.mocked(prisma.comment.update).mockResolvedValue({
        id: COMMENT_ID, pageId: PAGE_ID, authorId: "user-1", content: "Updated",
        resolved: false, createdAt: new Date(), author: mockUser,
      } as never);

      const caller = commentRouter.createCaller(mockCtx);
      const result = await caller.update({ commentId: COMMENT_ID, content: "Updated" });
      expect(result.content).toBe("Updated");
    });

    it("should throw FORBIDDEN when editing another user comment", async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        id: COMMENT_ID, pageId: PAGE_ID, authorId: OTHER_USER, content: "Their comment",
        resolved: false, createdAt: new Date(), page: { workspaceId: "ws-1" },
      } as never);
      vi.mocked(prisma.member.findUnique).mockResolvedValue({
        userId: "user-1", workspaceId: "ws-1", role: "MEMBER",
      } as never);

      const caller = commentRouter.createCaller(mockCtx);
      await expect(
        caller.update({ commentId: COMMENT_ID, content: "Hacked" }),
      ).rejects.toThrow("You can only edit your own comments");
    });
  });

  describe("delete", () => {
    it("should allow author to delete own comment", async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        id: COMMENT_ID, pageId: PAGE_ID, authorId: "user-1", content: "Bye",
        resolved: false, createdAt: new Date(), page: { workspaceId: "ws-1" },
      } as never);
      vi.mocked(prisma.comment.delete).mockResolvedValue({} as never);

      const caller = commentRouter.createCaller(mockCtx);
      const result = await caller.delete({ commentId: COMMENT_ID });
      expect(result.success).toBe(true);
      expect(result.id).toBe(COMMENT_ID);
    });

    it("should allow admin to delete another user comment", async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        id: COMMENT_ID, pageId: PAGE_ID, authorId: OTHER_USER, content: "Their comment",
        resolved: false, createdAt: new Date(), page: { workspaceId: "ws-1" },
      } as never);
      vi.mocked(prisma.member.findUnique).mockResolvedValue({
        userId: "user-1", workspaceId: "ws-1", role: "ADMIN",
      } as never);
      vi.mocked(prisma.comment.delete).mockResolvedValue({} as never);

      const caller = commentRouter.createCaller(mockCtx);
      const result = await caller.delete({ commentId: COMMENT_ID });
      expect(result.success).toBe(true);
    });

    it("should throw FORBIDDEN for non-admin non-author", async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        id: COMMENT_ID, pageId: PAGE_ID, authorId: OTHER_USER, content: "Their comment",
        resolved: false, createdAt: new Date(), page: { workspaceId: "ws-1" },
      } as never);
      vi.mocked(prisma.member.findUnique).mockResolvedValue({
        userId: "user-1", workspaceId: "ws-1", role: "MEMBER",
      } as never);

      const caller = commentRouter.createCaller(mockCtx);
      await expect(caller.delete({ commentId: COMMENT_ID })).rejects.toThrow(
        "Not authorized to delete this comment",
      );
    });
  });

  describe("resolve", () => {
    it("should resolve a comment", async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        id: COMMENT_ID, pageId: PAGE_ID, authorId: OTHER_USER, content: "Fix this",
        resolved: false, createdAt: new Date(), page: { workspaceId: "ws-1" },
      } as never);
      vi.mocked(prisma.member.findUnique).mockResolvedValue({
        userId: "user-1", workspaceId: "ws-1", role: "MEMBER",
      } as never);
      vi.mocked(prisma.comment.update).mockResolvedValue({
        id: COMMENT_ID, pageId: PAGE_ID, authorId: OTHER_USER, content: "Fix this",
        resolved: true, createdAt: new Date(), author: mockUser,
      } as never);

      const caller = commentRouter.createCaller(mockCtx);
      const result = await caller.resolve({ commentId: COMMENT_ID, resolved: true });
      expect(result.resolved).toBe(true);
    });

    it("should throw NOT_FOUND when comment does not exist", async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(null);

      const caller = commentRouter.createCaller(mockCtx);
      await expect(
        caller.resolve({ commentId: COMMENT_ID, resolved: true }),
      ).rejects.toThrow("Comment not found");
    });
  });

  describe("unresolvedCount", () => {
    it("should return count of unresolved comments", async () => {
      vi.mocked(prisma.page.findUnique).mockResolvedValue({
        id: PAGE_ID, workspaceId: "ws-1",
      } as never);
      vi.mocked(prisma.member.findUnique).mockResolvedValue({
        userId: "user-1", workspaceId: "ws-1", role: "MEMBER",
      } as never);
      vi.mocked(prisma.comment.count).mockResolvedValue(3);

      const caller = commentRouter.createCaller(mockCtx);
      const result = await caller.unresolvedCount({ pageId: PAGE_ID });
      expect(result.count).toBe(3);
    });

    it("should return 0 when no unresolved comments", async () => {
      vi.mocked(prisma.page.findUnique).mockResolvedValue({
        id: PAGE_ID, workspaceId: "ws-1",
      } as never);
      vi.mocked(prisma.member.findUnique).mockResolvedValue({
        userId: "user-1", workspaceId: "ws-1", role: "MEMBER",
      } as never);
      vi.mocked(prisma.comment.count).mockResolvedValue(0);

      const caller = commentRouter.createCaller(mockCtx);
      const result = await caller.unresolvedCount({ pageId: PAGE_ID });
      expect(result.count).toBe(0);
    });
  });
});