import { db } from '@/server/db';
import { cacheGet, cacheSet, cacheInvalidatePrefix } from '@/lib/cache';
import type { Page } from "@prisma/client";

const TREE_CACHE_TTL_MS = 30_000; // 30 seconds

export interface PageTreeNode {
  id: string;
  title: string;
  icon: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  parentId: string | null;
  workspaceId: string;
  children: PageTreeNode[];
}

export interface PageBreadcrumb {
  id: string;
  title: string;
  icon: string | null;
}

/**
 * Build a nested tree structure from a flat list of pages.
 * Supports unlimited nesting depth.
 */
export function buildTree(flatPages: Page[]): PageTreeNode[] {
  const pageMap = new Map<string, PageTreeNode>();
  const roots: PageTreeNode[] = [];

  // First pass: create all nodes
  for (const page of flatPages) {
    pageMap.set(page.id, {
      id: page.id,
      title: page.title,
      icon: page.icon,
      order: page.order,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      parentId: page.parentId,
      workspaceId: page.workspaceId,
      children: [],
    });
  }

  // Second pass: wire children to parents
  for (const page of flatPages) {
    const node = pageMap.get(page.id)!;
    if (page.parentId && pageMap.has(page.parentId)) {
      pageMap.get(page.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by order at each level
  const sortChildren = (nodes: PageTreeNode[]) => {
    nodes.sort((a, b) => a.order - b.order || a.createdAt.getTime() - b.createdAt.getTime());
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };

  sortChildren(roots);
  return roots;
}

/**
 * Get the full page tree for a workspace.
 * Results are cached in-memory for 30 seconds per workspace.
 */
export async function getPageTree(workspaceId: string): Promise<PageTreeNode[]> {
  const cacheKey = `page-tree:${workspaceId}`;
  const cached = cacheGet<PageTreeNode[]>(cacheKey);
  if (cached) return cached;

  const pages = await db.page.findMany({
    where: { workspaceId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });

  const tree = buildTree(pages);
  cacheSet(cacheKey, tree, TREE_CACHE_TTL_MS);
  return tree;
}

/**
 * Invalidate the cached page tree for a workspace.
 * Call this after mutations that affect the tree structure.
 */
export function invalidatePageTreeCache(workspaceId: string): void {
  cacheInvalidatePrefix(`page-tree:${workspaceId}`);
}

/**
 * Compute the breadcrumb path for a page (from root to the page itself).
 */
export async function getPagePath(pageId: string): Promise<PageBreadcrumb[]> {
  const path: PageBreadcrumb[] = [];
  let currentId: string | null = pageId;

  while (currentId) {
    const page = await db.page.findUnique({
      where: { id: currentId },
      select: { id: true, title: true, icon: true, parentId: true },
    });

    if (!page) break;

    path.unshift({ id: page.id, title: page.title, icon: page.icon });
    currentId = page.parentId;
  }

  return path;
}

/**
 * Get all ancestor IDs of a page (from parent up to root).
 */
export async function getAncestors(pageId: string): Promise<string[]> {
  const ancestors: string[] = [];
  let currentId: string | null = pageId;

  while (currentId) {
    const page = await db.page.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });

    if (!page || !page.parentId) break;

    ancestors.push(page.parentId);
    currentId = page.parentId;
  }

  return ancestors;
}

/**
 * Get all descendant IDs of a page (all children, grandchildren, etc.).
 * Uses batched queries to avoid N+1 problem.
 */
export async function getDescendants(pageId: string): Promise<string[]> {
  const descendants: string[] = [];
  let currentParentIds: string[] = [pageId];

  while (currentParentIds.length > 0) {
    const children = await db.page.findMany({
      where: { parentId: { in: currentParentIds } },
      select: { id: true },
    });

    const childIds = children.map((c) => c.id);
    descendants.push(...childIds);
    currentParentIds = childIds;
  }

  return descendants;
}

/**
 * Check whether moving a page to a new parent would create a cycle.
 */
export async function wouldCreateCycle(
  pageId: string,
  newParentId: string | null,
): Promise<boolean> {
  if (!newParentId) return false;
  if (pageId === newParentId) return true;

  const descendants = await getDescendants(pageId);
  return descendants.includes(newParentId);
}

/**
 * Get the next order value for a new child under a given parent.
 */
export async function getNextOrder(parentId: string | null, workspaceId: string): Promise<number> {
  const maxOrder = await db.page.aggregate({
    where: { parentId, workspaceId },
    _max: { order: true },
  });

  return (maxOrder._max.order ?? -1) + 1;
}
