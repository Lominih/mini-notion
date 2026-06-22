import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for snapshots service.
 * Tests snapshot creation, listing, retrieval, deletion, and auto-snapshot.
 */

// Mock yjs
vi.mock("yjs", () => {
  const Doc = vi.fn().mockImplementation(function () {
    return {
      destroy: vi.fn(),
      share: new Map(),
      get: vi.fn(),
    };
  });
  return {
    Doc,
    encodeStateAsUpdate: vi.fn(() => new Uint8Array([1, 2, 3])),
    applyUpdate: vi.fn(),
    diffUpdate: vi.fn(() => new Uint8Array([4, 5])),
  };
});

vi.mock("@/server/db", () => ({
  prisma: {
    snapshot: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/collaboration/yjs-manager", () => ({
  yjsManager: {
    getDoc: vi.fn(async () => {
      const { Doc } = await import("yjs");
      return new Doc();
    }),
    persistDoc: vi.fn(async () => {}),
  },
}));

import {
  createSnapshot,
  listSnapshots,
  getSnapshot,
  getSnapshotState,
  deleteSnapshot,
  deleteAllSnapshots,
  autoSnapshot,
} from "@/server/services/snapshots";
import { prisma } from "@/server/db";
import { yjsManager } from "@/server/collaboration/yjs-manager";

describe("snapshots service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSnapshot", () => {
    it("should create a snapshot with manual reason by default", async () => {
      const mockSnapshot = {
        id: "snap-1",
        pageId: "page-1",
        authorId: "user-1",
        state: Buffer.from([1, 2, 3]),
        metadata: JSON.stringify({ reason: "manual", stateSize: 3 }),
        createdAt: new Date("2025-06-01"),
      };
      vi.mocked(prisma.snapshot.create).mockResolvedValue(mockSnapshot as never);

      const result = await createSnapshot({
        pageId: "page-1",
        authorId: "user-1",
      });

      expect(result.id).toBe("snap-1");
      expect(result.pageId).toBe("page-1");
      expect(result.authorId).toBe("user-1");
      expect(result.metadata.reason).toBe("manual");
      expect(prisma.snapshot.create).toHaveBeenCalledOnce();
    });

    it("should use custom metadata when provided", async () => {
      const mockSnapshot = {
        id: "snap-2",
        pageId: "page-1",
        authorId: "user-1",
        state: Buffer.from([1, 2, 3]),
        metadata: JSON.stringify({ reason: "auto", label: "Test", stateSize: 3 }),
        createdAt: new Date(),
      };
      vi.mocked(prisma.snapshot.create).mockResolvedValue(mockSnapshot as never);

      const result = await createSnapshot({
        pageId: "page-1",
        authorId: "user-1",
        metadata: { reason: "auto", label: "Test" },
      });

      expect(result.metadata.reason).toBe("auto");
      expect(result.metadata.label).toBe("Test");
    });

    it("should call yjsManager.getDoc to get current state", async () => {
      vi.mocked(prisma.snapshot.create).mockResolvedValue({
        id: "snap-1",
        pageId: "page-1",
        authorId: "user-1",
        state: Buffer.from([1, 2, 3]),
        metadata: JSON.stringify({ reason: "manual", stateSize: 3 }),
        createdAt: new Date(),
      } as never);

      await createSnapshot({ pageId: "page-1", authorId: "user-1" });

      expect(yjsManager.getDoc).toHaveBeenCalledWith("page-1");
    });
  });

  describe("listSnapshots", () => {
    it("should list snapshots with default limit", async () => {
      vi.mocked(prisma.snapshot.findMany).mockResolvedValue([
        {
          id: "snap-1",
          pageId: "page-1",
          authorId: "user-1",
          state: Buffer.from([1]),
          metadata: JSON.stringify({ reason: "manual" }),
          createdAt: new Date("2025-06-01"),
        },
      ] as never);

      const result = await listSnapshots({ pageId: "page-1" });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("snap-1");
      expect(prisma.snapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, skip: 0 }),
      );
    });

    it("should support pagination with limit and offset", async () => {
      vi.mocked(prisma.snapshot.findMany).mockResolvedValue([]);

      await listSnapshots({ pageId: "page-1", limit: 10, offset: 20 });

      expect(prisma.snapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 }),
      );
    });

    it("should parse metadata from JSON string", async () => {
      vi.mocked(prisma.snapshot.findMany).mockResolvedValue([
        {
          id: "snap-1",
          pageId: "page-1",
          authorId: "user-1",
          state: Buffer.from([1]),
          metadata: JSON.stringify({ reason: "auto", label: "Scheduled" }),
          createdAt: new Date(),
        },
      ] as never);

      const result = await listSnapshots({ pageId: "page-1" });

      expect(result[0].metadata.reason).toBe("auto");
      expect(result[0].metadata.label).toBe("Scheduled");
    });
  });

  describe("getSnapshot", () => {
    it("should return snapshot by ID", async () => {
      vi.mocked(prisma.snapshot.findUnique).mockResolvedValue({
        id: "snap-1",
        pageId: "page-1",
        authorId: "user-1",
        state: Buffer.from([1]),
        metadata: JSON.stringify({ reason: "manual" }),
        createdAt: new Date(),
      } as never);

      const result = await getSnapshot("snap-1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("snap-1");
    });

    it("should return null for nonexistent snapshot", async () => {
      vi.mocked(prisma.snapshot.findUnique).mockResolvedValue(null);

      const result = await getSnapshot("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getSnapshotState", () => {
    it("should return raw state as Uint8Array", async () => {
      vi.mocked(prisma.snapshot.findUnique).mockResolvedValue({
        state: Buffer.from([10, 20, 30]),
      } as never);

      const result = await getSnapshotState("snap-1");

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result![0]).toBe(10);
      expect(result![1]).toBe(20);
      expect(result![2]).toBe(30);
    });

    it("should return null for nonexistent snapshot", async () => {
      vi.mocked(prisma.snapshot.findUnique).mockResolvedValue(null);

      const result = await getSnapshotState("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("deleteSnapshot", () => {
    it("should return true on successful deletion", async () => {
      vi.mocked(prisma.snapshot.delete).mockResolvedValue({} as never);

      const result = await deleteSnapshot("snap-1");

      expect(result).toBe(true);
      expect(prisma.snapshot.delete).toHaveBeenCalledWith({ where: { id: "snap-1" } });
    });

    it("should return false when deletion fails", async () => {
      vi.mocked(prisma.snapshot.delete).mockRejectedValue(new Error("Not found"));

      const result = await deleteSnapshot("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("deleteAllSnapshots", () => {
    it("should delete all snapshots and return count", async () => {
      vi.mocked(prisma.snapshot.deleteMany).mockResolvedValue({ count: 5 });

      const result = await deleteAllSnapshots("page-1");

      expect(result).toBe(5);
      expect(prisma.snapshot.deleteMany).toHaveBeenCalledWith({
        where: { pageId: "page-1" },
      });
    });

    it("should return 0 when no snapshots to delete", async () => {
      vi.mocked(prisma.snapshot.deleteMany).mockResolvedValue({ count: 0 });

      const result = await deleteAllSnapshots("page-1");

      expect(result).toBe(0);
    });
  });

  describe("autoSnapshot", () => {
    it("should create snapshot when no previous snapshot exists", async () => {
      vi.mocked(prisma.snapshot.findFirst).mockResolvedValue(null);
      const mockSnapshot = {
        id: "snap-auto",
        pageId: "page-1",
        authorId: "user-1",
        state: Buffer.from([1, 2, 3]),
        metadata: JSON.stringify({ reason: "scheduled", stateSize: 3 }),
        createdAt: new Date(),
      };
      vi.mocked(prisma.snapshot.create).mockResolvedValue(mockSnapshot as never);

      const result = await autoSnapshot({
        pageId: "page-1",
        authorId: "user-1",
      });

      expect(result).not.toBeNull();
      expect(result!.metadata.reason).toBe("scheduled");
    });

    it("should skip when last snapshot was too recent", async () => {
      vi.mocked(prisma.snapshot.findFirst).mockResolvedValue({
        createdAt: new Date(), // just now
      } as never);

      const result = await autoSnapshot({
        pageId: "page-1",
        authorId: "user-1",
        minIntervalMs: 30 * 60 * 1000, // 30 minutes
      });

      expect(result).toBeNull();
      expect(prisma.snapshot.create).not.toHaveBeenCalled();
    });

    it("should create snapshot when enough time has passed", async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      vi.mocked(prisma.snapshot.findFirst).mockResolvedValue({
        createdAt: twoHoursAgo,
      } as never);

      const mockSnapshot = {
        id: "snap-auto",
        pageId: "page-1",
        authorId: "user-1",
        state: Buffer.from([1]),
        metadata: JSON.stringify({ reason: "scheduled", stateSize: 1 }),
        createdAt: new Date(),
      };
      vi.mocked(prisma.snapshot.create).mockResolvedValue(mockSnapshot as never);

      const result = await autoSnapshot({
        pageId: "page-1",
        authorId: "user-1",
        minIntervalMs: 30 * 60 * 1000,
      });

      expect(result).not.toBeNull();
    });
  });
});
