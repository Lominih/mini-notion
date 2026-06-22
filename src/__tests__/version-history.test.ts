import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for version-history service.
 * Tests version creation, listing, restoration, and pruning.
 */

// Mock yjs
vi.mock("yjs", () => ({
  Doc: vi.fn().mockImplementation(function() {
    return {
      destroy: vi.fn(),
      share: new Map(),
      get: vi.fn(),
    };
  }),
  encodeStateAsUpdate: vi.fn(() => new Uint8Array([1, 2, 3])),
  applyUpdate: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    pageVersion: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/server/collaboration/yjs-manager", () => ({
  yjsManager: {
    getDoc: vi.fn(async () => new (await import("yjs")).Doc()),
    persistDoc: vi.fn(async () => {}),
    getStateAsUpdate: vi.fn(() => new Uint8Array([1, 2, 3])),
  },
}));

import { saveVersion, listVersions, getVersion, deleteVersion } from "@/server/services/version-history";
import { prisma } from "@/server/db";

describe("version-history service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveVersion", () => {
    it("should save a new version", async () => {
      const mockVersion = {
        id: "v1",
        pageId: "page-1",
        authorId: "user-1",
        state: Buffer.from([1, 2, 3]),
        label: "Test version",
        content: "{}",
        createdAt: new Date(),
      };
      vi.mocked(prisma.pageVersion.create).mockResolvedValue(mockVersion as never);
      vi.mocked(prisma.pageVersion.count).mockResolvedValue(1);

      const result = await saveVersion({
        pageId: "page-1",
        authorId: "user-1",
        label: "Test version",
      });

      expect(result.id).toBe("v1");
      expect(result.label).toBe("Test version");
      expect(prisma.pageVersion.create).toHaveBeenCalled();
    });

    it("should prune excess versions beyond limit", async () => {
      const mockVersion = {
        id: "v51",
        pageId: "page-1",
        authorId: "user-1",
        state: Buffer.from([1]),
        label: null,
        content: "{}",
        createdAt: new Date(),
      };
      vi.mocked(prisma.pageVersion.create).mockResolvedValue(mockVersion as never);
      vi.mocked(prisma.pageVersion.count).mockResolvedValue(51);
      vi.mocked(prisma.pageVersion.findMany).mockResolvedValue([
        { id: "v1" },
        { id: "v2" },
      ] as never);
      vi.mocked(prisma.pageVersion.deleteMany).mockResolvedValue({ count: 2 });

      await saveVersion({ pageId: "page-1", authorId: "user-1" });

      expect(prisma.pageVersion.deleteMany).toHaveBeenCalled();
    });
  });

  describe("listVersions", () => {
    it("should list versions for a page", async () => {
      const mockVersions = [
        { id: "v2", pageId: "page-1", authorId: "user-1", label: "v2", content: null, createdAt: new Date() },
        { id: "v1", pageId: "page-1", authorId: "user-1", label: "v1", content: null, createdAt: new Date() },
      ];
      vi.mocked(prisma.pageVersion.findMany).mockResolvedValue(mockVersions as never);

      const results = await listVersions({ pageId: "page-1" });

      expect(results).toHaveLength(2);
      expect(prisma.pageVersion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pageId: "page-1" },
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("should respect limit and offset", async () => {
      vi.mocked(prisma.pageVersion.findMany).mockResolvedValue([]);

      await listVersions({ pageId: "page-1", limit: 10, offset: 5 });

      expect(prisma.pageVersion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 5 }),
      );
    });
  });

  describe("getVersion", () => {
    it("should return a version by ID", async () => {
      const mockVersion = {
        id: "v1",
        pageId: "page-1",
        authorId: "user-1",
        state: Buffer.from([1]),
        label: "Version 1",
        content: "test",
        createdAt: new Date(),
      };
      vi.mocked(prisma.pageVersion.findUnique).mockResolvedValue(mockVersion as never);

      const result = await getVersion("v1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("v1");
    });

    it("should return null for non-existent version", async () => {
      vi.mocked(prisma.pageVersion.findUnique).mockResolvedValue(null);

      const result = await getVersion("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("deleteVersion", () => {
    it("should delete a version", async () => {
      vi.mocked(prisma.pageVersion.delete).mockResolvedValue({} as never);

      const result = await deleteVersion("v1");
      expect(result).toBe(true);
    });

    it("should return false for non-existent version", async () => {
      vi.mocked(prisma.pageVersion.delete).mockRejectedValue(new Error("Not found"));

      const result = await deleteVersion("nonexistent");
      expect(result).toBe(false);
    });
  });
});
