import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for search service.
 * Tests full-text search across page titles and content.
 */

vi.mock("@/server/db", () => ({
  db: {
    page: {
      findMany: vi.fn(),
    },
    pageTag: {
      findMany: vi.fn(),
    },
  },
}));

import { searchPages, type SearchFilters } from "@/server/services/search";
import { db } from "@/server/db";

function makePage(overrides: {
  id: string;
  title: string;
  content?: string;
  workspaceId?: string;
  updatedAt?: Date;
}) {
  return {
    id: overrides.id,
    title: overrides.title,
    icon: null,
    content: overrides.content ?? "[]",
    order: 0,
    isDeleted: false,
    workspaceId: overrides.workspaceId ?? "ws-1",
    parentId: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: overrides.updatedAt ?? new Date("2025-06-01"),
    createdById: "user-1",
  };
}

describe("search service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array for empty query", async () => {
    const results = await searchPages({ workspaceId: "ws-1", query: "" });
    expect(results).toEqual([]);
  });

  it("should return empty array for whitespace-only query", async () => {
    const results = await searchPages({ workspaceId: "ws-1", query: "   " });
    expect(results).toEqual([]);
  });

  it("should search and return scored results", async () => {
    const pages = [
      makePage({ id: "p1", title: "TypeScript Guide", content: '[]' }),
      makePage({ id: "p2", title: "JavaScript Basics", content: '[]' }),
    ];
    vi.mocked(db.page.findMany).mockResolvedValue(pages as never);

    const results = await searchPages({ workspaceId: "ws-1", query: "TypeScript" });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].page.id).toBe("p1");
    expect(results[0].matchedTitle).toBe(true);
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("should score title matches higher than content matches", async () => {
    const pages = [
      makePage({
        id: "p1",
        title: "Not TypeScript",
        content: JSON.stringify([
          { type: "paragraph", content: [{ type: "text", text: "TypeScript is great" }] },
        ]),
      }),
      makePage({
        id: "p2",
        title: "TypeScript Guide",
        content: JSON.stringify([
          { type: "paragraph", content: [{ type: "text", text: "Some other content" }] },
        ]),
      }),
    ];
    vi.mocked(db.page.findMany).mockResolvedValue(pages as never);

    const results = await searchPages({ workspaceId: "ws-1", query: "TypeScript" });

    expect(results[0].page.id).toBe("p2");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("should include highlights in results", async () => {
    const pages = [
      makePage({ id: "p1", title: "My TypeScript Notes" }),
    ];
    vi.mocked(db.page.findMany).mockResolvedValue(pages as never);

    const results = await searchPages({ workspaceId: "ws-1", query: "TypeScript" });

    expect(results[0].highlights).toBeDefined();
    expect(results[0].highlights.length).toBeGreaterThan(0);
    expect(results[0].highlights[0].field).toBe("title");
  });

  it("should call Prisma with correct workspace filter", async () => {
    vi.mocked(db.page.findMany).mockResolvedValue([]);

    await searchPages({ workspaceId: "ws-1", query: "test" });

    expect(db.page.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "ws-1" }),
      }),
    );
  });

  it("should filter by tags when provided", async () => {
    vi.mocked(db.pageTag.findMany).mockResolvedValue([
      { pageId: "p1" },
    ] as never);
    vi.mocked(db.page.findMany).mockResolvedValue([]);

    await searchPages({
      workspaceId: "ws-1",
      query: "test",
      tags: ["important"],
    });

    expect(db.pageTag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ name: { in: ["important"] } }),
      }),
    );
  });

  it("should return empty when tag filter yields no pages", async () => {
    vi.mocked(db.pageTag.findMany).mockResolvedValue([]);
    vi.mocked(db.page.findMany).mockResolvedValue([]);

    const results = await searchPages({
      workspaceId: "ws-1",
      query: "test",
      tags: ["nonexistent"],
    });

    expect(results).toEqual([]);
    expect(db.page.findMany).not.toHaveBeenCalled();
  });
});
