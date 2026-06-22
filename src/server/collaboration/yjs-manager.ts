import { Doc, encodeStateAsUpdate, applyUpdate, mergeUpdates } from "yjs";
import { prisma } from "@/server/db";

/**
 * Manages Yjs document instances for collaborative editing.
 * One Y.Doc per page, with periodic persistence and GC support.
 */

const MAX_GC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const PERSISTENCE_INTERVAL_MS = 30 * 1000; // 30 seconds
const MAX_VERSIONS_PER_PAGE = 50;
const GC_THRESHOLD_BYTES = 1024 * 1024; // 1MB state size triggers GC

interface ManagedDoc {
  doc: Doc;
  pageId: string;
  lastAccessed: number;
  persistenceTimer: ReturnType<typeof setInterval> | null;
  gcTimer: ReturnType<typeof setInterval> | null;
  dirty: boolean;
  clientCount: number;
}

class YjsManager {
  private docs: Map<string, ManagedDoc> = new Map();
  private initPromise: Map<string, Promise<Doc>> = new Map();

  /**
   * Get or create a Y.Doc for a given page.
   * Loads persisted state from the database if available.
   */
  async getDoc(pageId: string): Promise<Doc> {
    if (this.docs.has(pageId)) {
      const managed = this.docs.get(pageId)!;
      managed.lastAccessed = Date.now();
      return managed.doc;
    }

    // Deduplicate concurrent init calls for the same page
    if (this.initPromise.has(pageId)) {
      return this.initPromise.get(pageId)!;
    }

    const promise = this.loadOrCreateDoc(pageId);
    this.initPromise.set(pageId, promise);

    try {
      return await promise;
    } finally {
      this.initPromise.delete(pageId);
    }
  }

  /**
   * Apply an update from a client to the document.
   */
  applyUpdate(pageId: string, update: Uint8Array): void {
    const managed = this.docs.get(pageId);
    if (!managed) return;

    applyUpdate(managed.doc, update);
    managed.dirty = true;
    managed.lastAccessed = Date.now();
  }

  /**
   * Get the current state vector of a document.
   */
  getStateVector(pageId: string): Uint8Array | null {
    const managed = this.docs.get(pageId);
    if (!managed) return null;
    return managed.doc.getStateVector();
  }

  /**
   * Get the encoded state of a document as a Uint8Array.
   */
  getStateAsUpdate(pageId: string, stateVector?: Uint8Array): Uint8Array | null {
    const managed = this.docs.get(pageId);
    if (!managed) return null;
    return encodeStateAsUpdate(managed.doc, stateVector);
  }

  /**
   * Register a client connection for a page.
   * Starts persistence timers if this is the first client.
   */
  addClient(pageId: string): void {
    const managed = this.docs.get(pageId);
    if (!managed) return;

    managed.clientCount++;
    managed.lastAccessed = Date.now();

    if (managed.clientCount === 1) {
      this.startPersistenceTimer(pageId, managed);
      this.startGCTimer(pageId, managed);
    }
  }

  /**
   * Unregister a client connection.
   * Stops timers when no clients remain.
   */
  removeClient(pageId: string): void {
    const managed = this.docs.get(pageId);
    if (!managed) return;

    managed.clientCount = Math.max(0, managed.clientCount - 1);

    if (managed.clientCount === 0) {
      this.stopTimers(managed);
      // Persist immediately when last client leaves
      this.persistDoc(pageId, managed);
    }
  }

  /**
   * Force persist a document to the database.
   */
  async persistDoc(pageId: string, managed?: ManagedDoc): Promise<void> {
    const m = managed ?? this.docs.get(pageId);
    if (!m || !m.dirty) return;

    const state = encodeStateAsUpdate(m.doc);
    const stateVector = m.doc.getStateVector();

    try {
      await prisma.yjsState.upsert({
        where: { pageId },
        create: {
          pageId,
          state: Buffer.from(state),
          stateVector: Buffer.from(stateVector),
        },
        update: {
          state: Buffer.from(state),
          stateVector: Buffer.from(stateVector),
        },
      });
      m.dirty = false;
    } catch (error) {
      console.error(`[YjsManager] Failed to persist document for page ${pageId}:`, error);
    }
  }

  /**
   * Close and persist a specific document. Called when it's no longer needed.
   */
  async closeDoc(pageId: string): Promise<void> {
    const managed = this.docs.get(pageId);
    if (!managed) return;

    this.stopTimers(managed);

    if (managed.dirty) {
      await this.persistDoc(pageId, managed);
    }

    managed.doc.destroy();
    this.docs.delete(pageId);
  }

  /**
   * Shut down the manager, persisting and closing all documents.
   */
  async shutdown(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const pageId of this.docs.keys()) {
      closePromises.push(this.closeDoc(pageId));
    }

    await Promise.all(closePromises);
  }

  /**
   * Run garbage collection on a document.
   * Encodes state, encodes with current state vector to get compacted state,
   * and replaces the doc content.
   */
  async garbageCollect(pageId: string): Promise<void> {
    const managed = this.docs.get(pageId);
    if (!managed) return;

    const doc = managed.doc;
    const stateSize = encodeStateAsUpdate(doc).byteLength;

    if (stateSize < GC_THRESHOLD_BYTES) return;

    try {
      // Get the compacted state
      const compactedState = encodeStateAsUpdate(doc);
      const stateVector = doc.getStateVector();

      // Create a new doc, apply the compacted state, and swap
      const newDoc = new Doc();
      applyUpdate(newDoc, compactedState);

      // Copy the root contents
      const rootKeys = Array.from(doc.share.keys());
      for (const key of rootKeys) {
        const existingType = doc.get(key);
        const newType = newDoc.get(key);

        if (existingType && newType) {
          const subState = encodeStateAsUpdate(doc, undefined);
          applyUpdate(newDoc, subState);
        }
      }

      // Replace doc
      managed.doc.destroy();

      // Create replacement
      const freshDoc = new Doc();
      const fullState = encodeStateAsUpdate(doc);
      applyUpdate(freshDoc, fullState);

      // Re-register awareness and other setup will need to happen on client side
      const managed2 = this.docs.get(pageId);
      if (managed2) {
        managed2.doc = freshDoc;
        managed2.dirty = true;
      }

      // Persist the GC'd state
      await this.persistDoc(pageId);
      console.log(`[YjsManager] GC completed for page ${pageId}, state size: ${stateSize} bytes`);
    } catch (error) {
      console.error(`[YjsManager] GC failed for page ${pageId}:`, error);
    }
  }

  /**
   * Prune old versions from the database (keep max MAX_VERSIONS_PER_PAGE).
   */
  async pruneVersions(pageId: string): Promise<void> {
    try {
      const count = await prisma.pageVersion.count({ where: { pageId } });

      if (count <= MAX_VERSIONS_PER_PAGE) return;

      const excess = count - MAX_VERSIONS_PER_PAGE;
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
    } catch (error) {
      console.error(`[YjsManager] Failed to prune versions for page ${pageId}:`, error);
    }
  }

  /**
   * Replace a document's content with a new state (for version/snapshot restore).
   * Creates a fresh Doc from the provided update bytes, so the restored state
   * fully replaces the current state instead of merging additively.
   */
  async replaceDoc(pageId: string, update: Uint8Array): Promise<void> {
    const managed = this.docs.get(pageId);
    if (!managed) return;

    // Destroy the old doc
    managed.doc.destroy();

    // Create a fresh doc and apply the restored state
    const freshDoc = new Doc();
    applyUpdate(freshDoc, update);

    managed.doc = freshDoc;
    managed.dirty = true;
    managed.lastAccessed = Date.now();

    // Persist immediately
    await this.persistDoc(pageId, managed);
  }

  /**
   * Get the number of currently managed documents.
   */
  get size(): number {
    return this.docs.size;
  }

  // ─── Private ──────────────────────────────────────────────

  private async loadOrCreateDoc(pageId: string): Promise<Doc> {
    const doc = new Doc();

    try {
      const saved = await prisma.yjsState.findUnique({ where: { pageId } });

      if (saved) {
        const state = new Uint8Array(saved.state);
        applyUpdate(doc, state);
        console.log(`[YjsManager] Loaded persisted state for page ${pageId} (${state.byteLength} bytes)`);
      } else {
        console.log(`[YjsManager] Created new doc for page ${pageId}`);
      }
    } catch (error) {
      console.error(`[YjsManager] Failed to load state for page ${pageId}:`, error);
    }

    const managed: ManagedDoc = {
      doc,
      pageId,
      lastAccessed: Date.now(),
      persistenceTimer: null,
      gcTimer: null,
      dirty: false,
      clientCount: 0,
    };

    this.docs.set(pageId, managed);
    return doc;
  }

  private startPersistenceTimer(pageId: string, managed: ManagedDoc): void {
    if (managed.persistenceTimer) return;

    managed.persistenceTimer = setInterval(async () => {
      await this.persistDoc(pageId, managed);
    }, PERSISTENCE_INTERVAL_MS);
  }

  private startGCTimer(pageId: string, managed: ManagedDoc): void {
    if (managed.gcTimer) return;

    managed.gcTimer = setInterval(async () => {
      await this.garbageCollect(pageId);
      await this.pruneVersions(pageId);
    }, MAX_GC_INTERVAL_MS);
  }

  private stopTimers(managed: ManagedDoc): void {
    if (managed.persistenceTimer) {
      clearInterval(managed.persistenceTimer);
      managed.persistenceTimer = null;
    }
    if (managed.gcTimer) {
      clearInterval(managed.gcTimer);
      managed.gcTimer = null;
    }
  }
}

/** Singleton YjsManager instance */
export const yjsManager = new YjsManager();