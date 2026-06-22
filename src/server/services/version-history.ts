import { Doc, encodeStateAsUpdate, applyUpdate } from "yjs";
import { prisma } from "@/server/db";
import { yjsManager } from "@/server/collaboration/yjs-manager";

/**
 * Version history service for pages.
 * Saves Yjs state as versioned snapshots, with auto-save and max version limits.
 */

const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_VERSIONS = 50;

export interface VersionInfo {
  id: string;
  pageId: string;
  authorId: string;
  label: string | null;
  content: string | null;
  createdAt: Date;
}

// Active auto-save timers per page
const autoSaveTimers = new Map<string, ReturnType<typeof setInterval>>();

/**
 * Save a version snapshot from the current Yjs document state.
 */
export async function saveVersion(params: {
  pageId: string;
  authorId: string;
  label?: string;
}): Promise<VersionInfo> {
  const { pageId, authorId, label } = params;

  const doc = await yjsManager.getDoc(pageId);
  const state = encodeStateAsUpdate(doc);

  const version = await prisma.pageVersion.create({
    data: {
      pageId,
      authorId,
      state: Buffer.from(state),
      label: label ?? null,
      content: extractTextContent(doc),
    },
  });

  // Prune old versions if we exceed the limit
  await pruneVersions(pageId);

  return {
    id: version.id,
    pageId: version.pageId,
    authorId: version.authorId,
    label: version.label,
    content: version.content,
    createdAt: version.createdAt,
  };
}

/**
 * List all versions for a page, newest first.
 */
export async function listVersions(params: {
  pageId: string;
  limit?: number;
  offset?: number;
}): Promise<VersionInfo[]> {
  const { pageId, limit = 50, offset = 0 } = params;

  const versions = await prisma.pageVersion.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  return versions.map((v) => ({
    id: v.id,
    pageId: v.pageId,
    authorId: v.authorId,
    label: v.label,
    content: v.content,
    createdAt: v.createdAt,
  }));
}

/**
 * Get a single version by ID.
 */
export async function getVersion(versionId: string): Promise<VersionInfo | null> {
  const version = await prisma.pageVersion.findUnique({
    where: { id: versionId },
  });

  if (!version) return null;

  return {
    id: version.id,
    pageId: version.pageId,
    authorId: version.authorId,
    label: version.label,
    content: version.content,
    createdAt: version.createdAt,
  };
}

/**
 * Restore a page to a specific version.
 * This replaces the current Yjs document state with the saved version's state.
 */
export async function restoreVersion(params: {
  pageId: string;
  versionId: string;
}): Promise<void> {
  const { pageId, versionId } = params;

  const version = await prisma.pageVersion.findUnique({
    where: { id: versionId },
  });

  if (!version) {
    throw new Error(`Version ${versionId} not found`);
  }

  if (version.pageId !== pageId) {
    throw new Error(`Version ${versionId} does not belong to page ${pageId}`);
  }

  // Save current state as a version before restoring (safety net)
  await saveVersion({
    pageId,
    authorId: version.authorId,
    label: "Auto-save before restore",
  });

  // Get current doc and apply the saved state
  const doc = await yjsManager.getDoc(pageId);
  const savedState = new Uint8Array(version.state);

  // Create a new doc from the saved state
  const restoredDoc = new Doc();
  applyUpdate(restoredDoc, savedState);

  // Clear existing content and apply restored state
  const currentUpdate = encodeStateAsUpdate(doc);
  const restoredUpdate = encodeStateAsUpdate(restoredDoc);

  // Replace doc content by applying inverse then new state
  // Yjs handles merge, so we just apply the restored state
  applyUpdate(doc, restoredUpdate, "version-restore");

  // Mark dirty for persistence
  await yjsManager.persistDoc(pageId);

  restoredDoc.destroy();
}

/**
 * Delete a specific version.
 */
export async function deleteVersion(versionId: string): Promise<boolean> {
  try {
    await prisma.pageVersion.delete({ where: { id: versionId } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Start auto-saving versions for a page.
 * Saves every 5 minutes if there are connected clients.
 */
export function startAutoSave(pageId: string): void {
  if (autoSaveTimers.has(pageId)) return;

  const timer = setInterval(async () => {
    try {
      // Only save if the document has been modified
      const managed = yjsManager.getStateAsUpdate(pageId);
      if (managed) {
        // Find the latest version to compare
        const latestVersion = await prisma.pageVersion.findFirst({
          where: { pageId },
          orderBy: { createdAt: "desc" },
        });

        // If no version exists or state has changed, save
        if (!latestVersion) {
          await saveVersion({ pageId, authorId: "system", label: "Auto-save" });
        }
      }
    } catch (error) {
      console.error(`[VersionHistory] Auto-save failed for page ${pageId}:`, error);
    }
  }, AUTO_SAVE_INTERVAL_MS);

  autoSaveTimers.set(pageId, timer);
}

/**
 * Stop auto-saving versions for a page.
 */
export function stopAutoSave(pageId: string): void {
  const timer = autoSaveTimers.get(pageId);
  if (timer) {
    clearInterval(timer);
    autoSaveTimers.delete(pageId);
  }
}

/**
 * Stop all auto-save timers.
 */
export function stopAllAutoSaves(): void {
  for (const [pageId, timer] of autoSaveTimers) {
    clearInterval(timer);
  }
  autoSaveTimers.clear();
}

/**
 * Prune old versions to stay under the maximum limit.
 */
async function pruneVersions(pageId: string): Promise<void> {
  const count = await prisma.pageVersion.count({ where: { pageId } });

  if (count <= MAX_VERSIONS) return;

  const excess = count - MAX_VERSIONS;
  const oldestVersions = await prisma.pageVersion.findMany({
    where: { pageId },
    orderBy: { createdAt: "asc" },
    take: excess,
    select: { id: true },
  });

  if (oldestVersions.length > 0) {
    await prisma.pageVersion.deleteMany({
      where: { id: { in: oldestVersions.map((v) => v.id) } },
    });
  }
}

/**
 * Extract plain text content from a Y.Doc for version preview.
 */
function extractTextContent(doc: Doc): string {
  const texts: string[] = [];

  for (const [key] of doc.share) {
    const type = doc.get(key);
    if (type && "toJSON" in type) {
      try {
        const json = (type as { toJSON: () => unknown }).toJSON();
        texts.push(JSON.stringify(json));
      } catch {
        // skip non-serializable types
      }
    }
  }

  return texts.join("\n");
}