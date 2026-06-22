import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for tag router.
 * Tests tag CRUD operations within a workspace context.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    member: { findUnique: vi.fn() },
    page: { findFirst: vi.fn() },
    pageTag: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import { tagRouter } from "@/server/routers/tag";
import { prisma } from "@/lib/prisma";

const PAGE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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

describe("tag router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      userId: "user-1", workspaceId: "ws-1", role: "MEMBER",
    } as never);
  });

  describe("create", () => {
    it("should add a tag to a page", async () => {
      vi.mocked(prisma.page.findFirst).mockResolvedValue({
        id: PAGE_ID, workspaceId: "ws-1",
      } as never);
      vi.mocked(prisma.pageTag.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.pageTag.create).mockResolvedValue({
        id: "tag-1", pageId: PAGE_ID, name: "important",
      } as never);

      const caller = tagRouter.createCaller(mockCtx);
      const result = await caller.create({ pageId: PAGE_ID, name: "important" });

      expect(result.name).toBe("important");
      expect(prisma.pageTag.create).toHaveBeenCalledWith({
        data: { pageId: PAGE_ID, name: "important" },
      });
    });

    it("should throw NOT_FOUND if page is not in the workspace", async () => {
      vi.mocked(prisma.page.findFirst).mockResolvedValue(null);

      const caller = tagRouter.createCaller(mockCtx);
      await expect(
        caller.create({ pageId: PAGE_ID, name: "tag" }),
      ).rejects.toThrow("Page not found in this workspace");
    });

    it("should throw CONFLICT if tag already exists on the page", async () => {
      vi.mocked(prisma.page.findFirst).mockResolvedValue({
        id: PAGE_ID, workspaceId: "ws-1",
      } as never);
      vi.mocked(prisma.pageTag.findFirst).mockResolvedValue({
        id: "tag-1", pageId: PAGE_ID, name: "important",
      } as never);

      const caller = tagRouter.createCaller(mockCtx);
      await expect(
        caller.create({ pageId: PAGE_ID, name: "important" }),
      ).rejects.toThrow("This tag already exists on this page");
    });
  });

  describe("remove", () => {
    it("should remove a tag from a page", async () => {
      vi.mocked(prisma.page.findFirst).mockResolvedValue({
        id: PAGE_ID, workspaceId: "ws-1",
      } as never);
      vi.mocked(prisma.pageTag.deleteMany).mockResolvedValue({ count: 1 });

      const caller = tagRouter.createCaller(mockCtx);
      const result = await caller.remove({ pageId: PAGE_ID, name: "important" });

      expect(result.removed).toBe(true);
    });

    it("should return removed false when tag does not exist", async () => {
      vi.mocked(prisma.page.findFirst).mockResolvedValue({
        id: PAGE_ID, workspaceId: "ws-1",
      } as never);
      vi.mocked(prisma.pageTag.deleteMany).mockResolvedValue({ count: 0 });

      const caller = tagRouter.createCaller(mockCtx);
      const result = await caller.remove({ pageId: PAGE_ID, name: "nonexistent" });

      expect(result.removed).toBe(false);
    });

    it("should throw NOT_FOUND if page is not in workspace", async () => {
      vi.mocked(prisma.page.findFirst).mockResolvedValue(null);

      const caller = tagRouter.createCaller(mockCtx);
      await expect(
        caller.remove({ pageId: PAGE_ID, name: "tag" }),
      ).rejects.toThrow("Page not found in this workspace");
    });
  });

  describe("list", () => {
    it("should list all tags with usage counts", async () => {
      vi.mocked(prisma.pageTag.groupBy).mockResolvedValue([
        { name: "bug", _count: { id: 3 } },
        { name: "feature", _count: { id: 5 } },
      ] as never);

      const caller = tagRouter.createCaller(mockCtx);
      const result = await caller.list();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: "bug", count: 3 });
      expect(result[1]).toEqual({ name: "feature", count: 5 });
    });

    it("should return empty array when no tags exist", async () => {
      vi.mocked(prisma.pageTag.groupBy).mockResolvedValue([]);

      const caller = tagRouter.createCaller(mockCtx);
      const result = await caller.list();

      expect(result).toEqual([]);
    });
  });

  describe("rename", () => {
    it("should rename a tag across all pages", async () => {
      vi.mocked(prisma.pageTag.findMany).mockResolvedValue([]);
      vi.mocked(prisma.pageTag.updateMany).mockResolvedValue({ count: 3 });

      const caller = tagRouter.createCaller(mockCtx);
      const result = await caller.rename({ oldName: "bug", newName: "issue" });

      expect(result.updated).toBe(3);
      expect(prisma.pageTag.updateMany).toHaveBeenCalledWith({
        where: { page: { workspaceId: "ws-1" }, name: "bug" },
        data: { name: "issue" },
      });
    });

    it("should return updated 0 when old and new names are the same", async () => {
      const caller = tagRouter.createCaller(mockCtx);
      const result = await caller.rename({ oldName: "bug", newName: "bug" });

      expect(result.updated).toBe(0);
      expect(prisma.pageTag.updateMany).not.toHaveBeenCalled();
    });

    it("should throw CONFLICT if new name already exists on pages", async () => {
      vi.mocked(prisma.pageTag.findMany).mockResolvedValue([
        { pageId: PAGE_ID },
      ] as never);

      const caller = tagRouter.createCaller(mockCtx);
      await expect(
        caller.rename({ oldName: "bug", newName: "feature" }),
      ).rejects.toThrow('The tag "feature" already exists on 1 page(s)');
    });
  });

  describe("delete", () => {
    it("should delete a tag from all pages in workspace", async () => {
      vi.mocked(prisma.pageTag.deleteMany).mockResolvedValue({ count: 5 });

      const caller = tagRouter.createCaller(mockCtx);
      const result = await caller.delete({ name: "bug" });

      expect(result.deleted).toBe(5);
      expect(prisma.pageTag.deleteMany).toHaveBeenCalledWith({
        where: { page: { workspaceId: "ws-1" }, name: "bug" },
      });
    });

    it("should return deleted 0 when tag does not exist", async () => {
      vi.mocked(prisma.pageTag.deleteMany).mockResolvedValue({ count: 0 });

      const caller = tagRouter.createCaller(mockCtx);
      const result = await caller.delete({ name: "nonexistent" });

      expect(result.deleted).toBe(0);
    });
  });
});