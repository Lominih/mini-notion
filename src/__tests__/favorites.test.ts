import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for favorites service.
 * Tests adding, removing, toggling, and listing user favorites.
 */

vi.mock("@/server/db", () => ({
  db: {
    favorite: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import {
  addFavorite,
  removeFavorite,
  toggleFavorite,
  isFavorited,
  listFavorites,
  getFavoriteIds,
} from "@/server/services/favorites";
import { db } from "@/server/db";

describe("favorites service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addFavorite", () => {
    it("should upsert a favorite", async () => {
      const mockResult = { id: "fav-1", userId: "user-1", pageId: "page-1" };
      vi.mocked(db.favorite.upsert).mockResolvedValue(mockResult as never);

      const result = await addFavorite("user-1", "page-1");

      expect(result.id).toBe("fav-1");
      expect(db.favorite.upsert).toHaveBeenCalledWith({
        where: { userId_pageId: { userId: "user-1", pageId: "page-1" } },
        update: {},
        create: { userId: "user-1", pageId: "page-1" },
      });
    });

    it("should handle re-adding an existing favorite", async () => {
      const mockResult = { id: "fav-1", userId: "user-1", pageId: "page-1" };
      vi.mocked(db.favorite.upsert).mockResolvedValue(mockResult as never);

      const result = await addFavorite("user-1", "page-1");

      expect(result.id).toBe("fav-1");
      expect(db.favorite.upsert).toHaveBeenCalledOnce();
    });
  });

  describe("removeFavorite", () => {
    it("should delete favorites matching user and page", async () => {
      vi.mocked(db.favorite.deleteMany).mockResolvedValue({ count: 1 });

      await removeFavorite("user-1", "page-1");

      expect(db.favorite.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1", pageId: "page-1" },
      });
    });

    it("should return count of deleted favorites", async () => {
      vi.mocked(db.favorite.deleteMany).mockResolvedValue({ count: 0 });

      const result = await removeFavorite("user-1", "nonexistent");

      expect(result.count).toBe(0);
    });
  });

  describe("toggleFavorite", () => {
    it("should add favorite when not currently favorited", async () => {
      vi.mocked(db.favorite.findUnique).mockResolvedValue(null);
      vi.mocked(db.favorite.create).mockResolvedValue({
        id: "fav-1",
        userId: "user-1",
        pageId: "page-1",
      } as never);

      const result = await toggleFavorite("user-1", "page-1");

      expect(result).toBe(true);
      expect(db.favorite.create).toHaveBeenCalledWith({
        data: { userId: "user-1", pageId: "page-1" },
      });
      expect(db.favorite.delete).not.toHaveBeenCalled();
    });

    it("should remove favorite when currently favorited", async () => {
      vi.mocked(db.favorite.findUnique).mockResolvedValue({
        id: "fav-1",
        userId: "user-1",
        pageId: "page-1",
      } as never);
      vi.mocked(db.favorite.delete).mockResolvedValue({} as never);

      const result = await toggleFavorite("user-1", "page-1");

      expect(result).toBe(false);
      expect(db.favorite.delete).toHaveBeenCalledWith({
        where: { id: "fav-1" },
      });
      expect(db.favorite.create).not.toHaveBeenCalled();
    });
  });

  describe("isFavorited", () => {
    it("should return true when count > 0", async () => {
      vi.mocked(db.favorite.count).mockResolvedValue(1);

      const result = await isFavorited("user-1", "page-1");

      expect(result).toBe(true);
      expect(db.favorite.count).toHaveBeenCalledWith({
        where: { userId: "user-1", pageId: "page-1" },
      });
    });

    it("should return false when count is 0", async () => {
      vi.mocked(db.favorite.count).mockResolvedValue(0);

      const result = await isFavorited("user-1", "page-1");

      expect(result).toBe(false);
    });
  });

  describe("listFavorites", () => {
    it("should return favorite pages for a user in a workspace", async () => {
      const mockPage = {
        id: "page-1",
        title: "My Page",
        icon: null,
        content: "[]",
        order: 0,
        isDeleted: false,
        workspaceId: "ws-1",
        parentId: null,
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-06-01"),
        createdById: "user-1",
      };
      vi.mocked(db.favorite.findMany).mockResolvedValue([
        { id: "fav-1", userId: "user-1", pageId: "page-1", page: mockPage },
      ] as never);

      const result = await listFavorites("user-1", "ws-1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("page-1");
      expect(result[0].isFavorited).toBe(true);
    });

    it("should return empty array when no favorites exist", async () => {
      vi.mocked(db.favorite.findMany).mockResolvedValue([]);

      const result = await listFavorites("user-1", "ws-1");

      expect(result).toEqual([]);
    });

    it("should call findMany with correct workspace filter", async () => {
      vi.mocked(db.favorite.findMany).mockResolvedValue([]);

      await listFavorites("user-1", "ws-1");

      expect(db.favorite.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", page: { workspaceId: "ws-1" } },
        include: { page: true },
        orderBy: { id: "asc" },
      });
    });
  });

  describe("getFavoriteIds", () => {
    it("should return a Set of favorite page IDs", async () => {
      vi.mocked(db.favorite.findMany).mockResolvedValue([
        { pageId: "page-1" },
        { pageId: "page-2" },
        { pageId: "page-3" },
      ] as never);

      const result = await getFavoriteIds("user-1");

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(3);
      expect(result.has("page-1")).toBe(true);
      expect(result.has("page-2")).toBe(true);
      expect(result.has("page-3")).toBe(true);
    });

    it("should return empty Set when no favorites", async () => {
      vi.mocked(db.favorite.findMany).mockResolvedValue([]);

      const result = await getFavoriteIds("user-1");

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });
});
