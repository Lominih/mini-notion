import { Doc, encodeStateAsUpdate, applyUpdate, diffUpdate } from "yjs";
import { prisma } from "@/server/db";
import { yjsManager } from "@/server/collaboration/yjs-manager";

/**
 * Document snapshot service.
 * Full state snapshots with diffing, restoration, and metadata.
 */

export interface SnapshotInfo {
  id: string;
  pageId: string;
  authorId: string;
  metadata: SnapshotMetadata;
  createdAt: Date;
}

export interface SnapshotMetadata {
  reason: "manual" | "auto" | "before-restore" | "before-delete" | "scheduled";
  label?: string;
  stateSize?: number;
  [key: string]: unknown;
}

export interface SnapshotDiff {
  additions: number;
  deletions: number;
  updateSize: number;
}

/**
 * Create a full document snapshot from the current Yjs state.
 */
export async function createSnapshot(params: {
  pageId: string;
  authorId: string;
  metadata?: Partial<SnapshotMetadata>;
}): Promise<SnapshotInfo> {
  const { pageId, authorId, metadata = {} } = params;

  const doc = await yjsManager.getDoc(pageId);
  const state = encodeStateAsUpdate(doc);

  const snapshotMetadata: SnapshotMetadata = {
    reason: metadata.reason ?? "manual",
    label: metadata.label,
    stateSize: state.byteLength,
    ...metadata,
  };

  const snapshot = await prisma.snapshot.create({
    data: {
      pageId,
      authorId,
      state: Buffer.from(state),
      metadata: JSON.stringify(snapshotMetadata),
    },
  });

  return {
    id: snapshot.id,
    pageId: snapshot.pageId,
    authorId: snapshot.authorId,
    metadata: snapshotMetadata,
    createdAt: snapshot.createdAt,
  };
}

/**
 * List all snapshots for a page, newest first.
 */
export async function listSnapshots(params: {
  pageId: string;
  limit?: number;
  offset?: number;
}): Promise<SnapshotInfo[]> {
  const { pageId, limit = 50, offset = 0 } = params;

  const snapshots = await prisma.snapshot.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  return snapshots.map((s) => ({
    id: s.id,
    pageId: s.pageId,
    authorId: s.authorId,
    metadata: JSON.parse(s.metadata) as SnapshotMetadata,
    createdAt: s.createdAt,
  }));
}

/**
 * Get a single snapshot by ID.
 */
export async function getSnapshot(snapshotId: string): Promise<SnapshotInfo | null> {
  const snapshot = await prisma.snapshot.findUnique({
    where: { id: snapshotId },
  });

  if (!snapshot) return null;

  return {
    id: snapshot.id,
    pageId: snapshot.pageId,
    authorId: snapshot.authorId,
    metadata: JSON.parse(snapshot.metadata) as SnapshotMetadata,
    createdAt: snapshot.createdAt,
  };
}

/**
 * Get the raw Yjs state from a snapshot.
 */
export async function getSnapshotState(snapshotId: string): Promise<Uint8Array | null> {
  const snapshot = await prisma.snapshot.findUnique({
    where: { id: snapshotId },
    select: { state: true },
  });

  if (!snapshot) return null;

  return new Uint8Array(snapshot.state);
}

/**
 * Restore a page to a specific snapshot.
 * Creates a safety snapshot before restoring.
 */
export async function restoreSnapshot(params: {
  pageId: string;
  snapshotId: string;
  authorId: string;
}): Promise<void> {
  const { pageId, snapshotId, authorId } = params;

  const snapshot = await prisma.snapshot.findUnique({
    where: { id: snapshotId },
  });

  if (!snapshot) {
    throw new Error(`Snapshot ${snapshotId} not found`);
  }

  if (snapshot.pageId !== pageId) {
    throw new Error(`Snapshot ${snapshotId} does not belong to page ${pageId}`);
  }

  // Create safety snapshot before restore
  await createSnapshot({
    pageId,
    authorId,
    metadata: { reason: "before-restore", label: `Before restoring snapshot ${snapshotId}` },
  });

  // Apply the snapshot state to the current doc
  const doc = await yjsManager.getDoc(pageId);
  const savedState = new Uint8Array(snapshot.state);
  const restoredDoc = new Doc();
  applyUpdate(restoredDoc, savedState);

  const restoredUpdate = encodeStateAsUpdate(restoredDoc);
  applyUpdate(doc, restoredUpdate, "snapshot-restore");

  await yjsManager.persistDoc(pageId);
  restoredDoc.destroy();
}

/**
 * Compare two snapshots and return a diff.
 * Returns the number of additions, deletions, and the update size
 * needed to go from snapshot A to snapshot B.
 */
export async function diffSnapshots(params: {
  snapshotIdA: string;
  snapshotIdB: string;
}): Promise<SnapshotDiff> {
  const { snapshotIdA, snapshotIdB } = params;

  const [snapshotA, snapshotB] = await Promise.all([
    prisma.snapshot.findUnique({ where: { id: snapshotIdA }, select: { state: true } }),
    prisma.snapshot.findUnique({ where: { id: snapshotIdB }, select: { state: true } }),
  ]);

  if (!snapshotA) throw new Error(`Snapshot ${snapshotIdA} not found`);
  if (!snapshotB) throw new Error(`Snapshot ${snapshotIdB} not found`);

  const stateA = new Uint8Array(snapshotA.state);
  const stateB = new Uint8Array(snapshotB.state);

  // Use Yjs diff to compute the update needed to go from A to B
  const update = diffUpdate(stateA, stateB);

  // Create temporary docs to count actual content changes
  const docA = new Doc();
  const docB = new Doc();
  applyUpdate(docA, stateA);
  applyUpdate(docB, stateB);

  const stateAEncoded = encodeStateAsUpdate(docA);
  const stateBEncoded = encodeStateAsUpdate(docB);

  // Count block-level changes as a heuristic for additions/deletions
  const textA = extractBlockText(docA);
  const textB = extractBlockText(docB);

  const additions = textB.filter((line) => !textA.includes(line)).length;
  const deletions = textA.filter((line) => !textB.includes(line)).length;

  docA.destroy();
  docB.destroy();

  return {
    additions,
    deletions,
    updateSize: update.byteLength,
  };
}

/**
 * Delete a snapshot.
 */
export async function deleteSnapshot(snapshotId: string): Promise<boolean> {
  try {
    await prisma.snapshot.delete({ where: { id: snapshotId } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete all snapshots for a page.
 */
export async function deleteAllSnapshots(pageId: string): Promise<number> {
  const result = await prisma.snapshot.deleteMany({ where: { pageId } });
  return result.count;
}

/**
 * Create a scheduled auto-snapshot if enough time has passed.
 */
export async function autoSnapshot(params: {
  pageId: string;
  authorId: string;
  minIntervalMs?: number;
}): Promise<SnapshotInfo | null> {
  const { pageId, authorId, minIntervalMs = 30 * 60 * 1000 } = params;

  // Check last snapshot time
  const lastSnapshot = await prisma.snapshot.findFirst({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (lastSnapshot) {
    const elapsed = Date.now() - lastSnapshot.createdAt.getTime();
    if (elapsed < minIntervalMs) return null;
  }

  return createSnapshot({
    pageId,
    authorId,
    metadata: { reason: "scheduled", label: "Scheduled auto-snapshot" },
  });
}

// ─── Helpers ──────────────────────────────────────

function extractBlockText(doc: Doc): string[] {
  const lines: string[] = [];

  for (const [key] of doc.share) {
    const type = doc.get(key);
    if (type && "toJSON" in type) {
      try {
        const json = (type as { toJSON: () => unknown }).toJSON();
        if (typeof json === "string") {
          lines.push(...json.split("\n"));
        } else if (Array.isArray(json)) {
          for (const item of json) {
            if (typeof item === "object" && item !== null && "content" in item) {
              lines.push(String((item as { content: unknown }).content));
            }
          }
        }
      } catch {
        // skip
      }
    }
  }

  return lines;
}