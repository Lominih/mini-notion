import { describe, it, expect } from "vitest";
import { buildTree, type PageTreeNode } from "@/server/services/page-tree";

/**
 * Unit tests for the page-tree service.
 * Tests tree building, breadcrumbs, and hierarchy utilities.
 */

function makePage(overrides: {
  id: string;
  title?: string;
  parentId?: string | null;
  order?: number;
  workspaceId?: string;
  icon?: string | null;
}) {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    icon: overrides.icon ?? null,
    content: "[]",
    order: overrides.order ?? 0,
    isDeleted: false,
    workspaceId: overrides.workspaceId ?? "ws-1",
    parentId: overrides.parentId ?? null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    createdById: "user-1",
  };
}

describe("page-tree service", () => {
  describe("buildTree", () => {
    it("should return empty array for no pages", () => {
      const tree = buildTree([]);
      expect(tree).toEqual([]);
    });

    it("should build a flat tree from root pages", () => {
      const pages = [
        makePage({ id: "p1", order: 0 }),
        makePage({ id: "p2", order: 1 }),
        makePage({ id: "p3", order: 2 }),
      ];
      const tree = buildTree(pages);

      expect(tree).toHaveLength(3);
      expect(tree.map((n) => n.id)).toEqual(["p1", "p2", "p3"]);
    });

    it("should nest children under parents", () => {
      const pages = [
        makePage({ id: "parent", order: 0 }),
        makePage({ id: "child1", parentId: "parent", order: 0 }),
        makePage({ id: "child2", parentId: "parent", order: 1 }),
      ];
      const tree = buildTree(pages);

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe("parent");
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children.map((c) => c.id)).toEqual(["child1", "child2"]);
    });

    it("should handle deeply nested trees", () => {
      const pages = [
        makePage({ id: "root", order: 0 }),
        makePage({ id: "a", parentId: "root", order: 0 }),
        makePage({ id: "b", parentId: "a", order: 0 }),
        makePage({ id: "c", parentId: "b", order: 0 }),
      ];
      const tree = buildTree(pages);

      expect(tree[0].children[0].children[0].children[0].id).toBe("c");
    });

    it("should sort children by order", () => {
      const pages = [
        makePage({ id: "parent", order: 0 }),
        makePage({ id: "child3", parentId: "parent", order: 2 }),
        makePage({ id: "child1", parentId: "parent", order: 0 }),
        makePage({ id: "child2", parentId: "parent", order: 1 }),
      ];
      const tree = buildTree(pages);

      expect(tree[0].children.map((c) => c.id)).toEqual(["child1", "child2", "child3"]);
    });

    it("should handle orphaned children by placing them at root", () => {
      const pages = [
        makePage({ id: "orphan", parentId: "nonexistent", order: 0 }),
      ];
      const tree = buildTree(pages);

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe("orphan");
    });

    it("should preserve page metadata", () => {
      const pages = [makePage({ id: "p1", title: "My Page", icon: "📄" })];
      const tree = buildTree(pages);

      expect(tree[0].title).toBe("My Page");
      expect(tree[0].icon).toBe("📄");
      expect(tree[0].workspaceId).toBe("ws-1");
    });

    it("should build a complex multi-level tree", () => {
      const pages = [
        makePage({ id: "root1", order: 0 }),
        makePage({ id: "root2", order: 1 }),
        makePage({ id: "r1-child1", parentId: "root1", order: 0 }),
        makePage({ id: "r1-child2", parentId: "root1", order: 1 }),
        makePage({ id: "r2-child1", parentId: "root2", order: 0 }),
        makePage({ id: "r1c1-grandchild", parentId: "r1-child1", order: 0 }),
      ];
      const tree = buildTree(pages);

      expect(tree).toHaveLength(2);
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].children).toHaveLength(1);
      expect(tree[0].children[0].children[0].id).toBe("r1c1-grandchild");
      expect(tree[1].children).toHaveLength(1);
    });
  });
});
