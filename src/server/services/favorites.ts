import { db } from '@/server/db';
import type { Page } from "@prisma/client";

/**
 * Add a page to a user's favorites.
 */
export async function addFavorite(userId: string, pageId: string) {
  return db.favorite.upsert({
    where: {
      userId_pageId: { userId, pageId },
    },
    update: {},
    create: { userId, pageId },
  });
}

/**
 * Remove a page from a user's favorites.
 */
export async function removeFavorite(userId: string, pageId: string) {
  return db.favorite.deleteMany({
    where: { userId, pageId },
  });
}

/**
 * Toggle a page's favorite status.
 * Returns `true` if the page is now a favorite, `false` otherwise.
 */
export async function toggleFavorite(userId: string, pageId: string): Promise<boolean> {
  const existing = await db.favorite.findUnique({
    where: { userId_pageId: { userId, pageId } },
  });

  if (existing) {
    await db.favorite.delete({ where: { id: existing.id } });
    return false;
  }

  await db.favorite.create({ data: { userId, pageId } });
  return true;
}

/**
 * Check if a page is favorited by a user.
 */
export async function isFavorited(userId: string, pageId: string): Promise<boolean> {
  const count = await db.favorite.count({
    where: { userId, pageId },
  });
  return count > 0;
}

/**
 * List all favorite pages for a user within a workspace.
 */
export async function listFavorites(
  userId: string,
  workspaceId: string,
): Promise<(Page & { isFavorited: true })[]> {
  const favorites = await db.favorite.findMany({
    where: {
      userId,
      page: { workspaceId },
    },
    include: { page: true },
    orderBy: { id: 'asc' },
  });

  return favorites.map((f) => ({
    ...f.page,
    isFavorited: true as const,
  }));
}

/**
 * Get favorite IDs for a user (useful for bulk-checking in page lists).
 */
export async function getFavoriteIds(userId: string): Promise<Set<string>> {
  const favorites = await db.favorite.findMany({
    where: { userId },
    select: { pageId: true },
  });

  return new Set(favorites.map((f) => f.pageId));
}
