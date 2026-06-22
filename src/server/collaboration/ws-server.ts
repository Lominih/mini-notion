import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { encodeStateAsUpdate } from "yjs";
import { yjsManager } from "./yjs-manager";

/**
 * Socket.IO-based collaboration server.
 * Manages rooms (one per page), syncs Yjs updates, and broadcasts awareness.
 */

const CORS_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface ClientInfo {
  socketId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  pageId: string;
  cursor: { anchor: number; head: number } | null;
  lastActive: number;
}

interface AwarenessState {
  userId: string;
  userName: string;
  userAvatar?: string;
  cursor: { anchor: number; head: number } | null;
  lastActive: number;
}

/**
 * Create and attach the collaboration Socket.IO server.
 */
export function createCollaborationServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: CORS_ORIGIN,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    pingInterval: 20000,
    pingTimeout: 10000,
  });

  // Room �?set of connected client infos
  const rooms = new Map<string, Map<string, ClientInfo>>();

  // Doc �?doc listeners so we can unsubscribe on room empty
  const docListeners = new Map<string, (update: Uint8Array, origin: unknown) => void>();

  const collabNamespace = io.of("/collab");

  collabNamespace.on("connection", (socket: Socket) => {
    let currentRoom: string | null = null;
    let clientInfo: ClientInfo | null = null;

    console.log(`[Collab] Client connected: ${socket.id}`);

    // ── Join Room ──────────────────────────────────
    socket.on("join-room", async (data: { pageId: string; userId: string; userName: string; userAvatar?: string }) => {
      const { pageId, userId, userName, userAvatar } = data;

      if (!pageId || !userId) {
        socket.emit("error", { message: "pageId and userId are required" });
        return;
      }

      // Leave previous room if any
      if (currentRoom) {
        leaveRoom(socket, currentRoom);
      }

      currentRoom = pageId;

      clientInfo = {
        socketId: socket.id,
        userId,
        userName,
        userAvatar,
        pageId,
        cursor: null,
        lastActive: Date.now(),
      };

      await joinRoom(socket, pageId, clientInfo);
    });

    // ── Yjs Update ─────────────────────────────────
    socket.on("yjs-update", (data: { pageId: string; update: number[] }) => {
      if (!data.pageId || !data.update) return;

      const update = new Uint8Array(data.update);
      yjsManager.applyUpdate(data.pageId, update);

      // Broadcast to all other clients in the room
      if (currentRoom === data.pageId) {
        socket.to(`page:${data.pageId}`).emit("yjs-update", {
          pageId: data.pageId,
          update: data.update,
          senderId: socket.id,
        });
      }
    });

    // ── Yjs Sync (request full state) ──────────────
    socket.on("yjs-sync-request", async (data: { pageId: string; stateVector?: number[] }) => {
      if (!data.pageId) return;

      const doc = await yjsManager.getDoc(data.pageId);
      const sv = data.stateVector ? new Uint8Array(data.stateVector) : undefined;
      const state = encodeStateAsUpdate(doc, sv);

      socket.emit("yjs-sync-response", {
        pageId: data.pageId,
        state: Array.from(state),
      });
    });

    // ── Awareness Update ────────────────────────────
    socket.on("yjs-awareness", (data: { pageId: string; awareness: AwarenessState }) => {
      if (!data.pageId || !data.awareness || !clientInfo) return;

      // Update local client info
      clientInfo.cursor = data.awareness.cursor;
      clientInfo.lastActive = Date.now();

      // Broadcast to all other clients in the room
      socket.to(`page:${data.pageId}`).emit("yjs-awareness", {
        pageId: data.pageId,
        socketId: socket.id,
        awareness: {
          ...data.awareness,
          lastActive: Date.now(),
        },
      });
    });

    // ── Presence List Request ───────────────────────
    socket.on("presence-request", (data: { pageId: string }) => {
      if (!data.pageId) return;

      const roomClients = rooms.get(data.pageId);
      if (!roomClients) return;

      const presenceList = Array.from(roomClients.values()).map((c) => ({
        socketId: c.socketId,
        userId: c.userId,
        userName: c.userName,
        userAvatar: c.userAvatar,
        cursor: c.cursor,
        lastActive: c.lastActive,
      }));

      socket.emit("presence-list", { pageId: data.pageId, users: presenceList });
    });

    // ── Leave Room ──────────────────────────────────
    socket.on("leave-room", (data: { pageId: string }) => {
      if (data.pageId) {
        leaveRoom(socket, data.pageId);
        if (currentRoom === data.pageId) {
          currentRoom = null;
          clientInfo = null;
        }
      }
    });

    // ── Disconnect ──────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`[Collab] Client disconnected: ${socket.id}`);

      if (currentRoom) {
        leaveRoom(socket, currentRoom);
      }
    });
  });

  // ─── Room Helpers ──────────────────────────────────

  async function joinRoom(socket: Socket, pageId: string, info: ClientInfo): Promise<void> {
    socket.join(`page:${pageId}`);
    yjsManager.addClient(pageId);

    // Track client in room
    if (!rooms.has(pageId)) {
      rooms.set(pageId, new Map());
    }
    rooms.get(pageId)!.set(socket.id, info);

    // Set up doc update listener for this room (once per doc)
    if (!docListeners.has(pageId)) {
      const doc = await yjsManager.getDoc(pageId);
      const listener = (update: Uint8Array, origin: unknown) => {
        // Skip updates from the origin client �?they already have it
        if (typeof origin === "string") {
          collabNamespace.to(`page:${pageId}`).except(origin).emit("yjs-update", {
            pageId,
            update: Array.from(update),
            senderId: origin,
          });
        } else {
          collabNamespace.to(`page:${pageId}`).emit("yjs-update", {
            pageId,
            update: Array.from(update),
            senderId: null,
          });
        }
      };
      doc.on("update", listener);
      docListeners.set(pageId, listener);
    }

    // Send current doc state to the joining client
    const doc = await yjsManager.getDoc(pageId);
    const fullState = encodeStateAsUpdate(doc);
    socket.emit("yjs-sync-response", {
      pageId,
      state: Array.from(fullState),
    });

    // Broadcast updated presence list to all in room
    broadcastPresenceList(pageId);

    console.log(`[Collab] Client ${socket.id} joined room ${pageId}`);
  }

  function leaveRoom(socket: Socket, pageId: string): void {
    socket.leave(`page:${pageId}`);
    yjsManager.removeClient(pageId);

    const roomClients = rooms.get(pageId);
    if (roomClients) {
      roomClients.delete(socket.id);

      // Clean up empty rooms
      if (roomClients.size === 0) {
        rooms.delete(pageId);
        const listener = docListeners.get(pageId);
        if (listener) {
          // We can't easily remove the listener here since we'd need the doc reference
          // but the doc is managed by yjsManager which handles GC
          docListeners.delete(pageId);
        }
      }
    }

    // Broadcast departure
    collabNamespace.to(`page:${pageId}`).emit("user-left", {
      pageId,
      socketId: socket.id,
    });

    broadcastPresenceList(pageId);
    console.log(`[Collab] Client ${socket.id} left room ${pageId}`);
  }

  function broadcastPresenceList(pageId: string): void {
    const roomClients = rooms.get(pageId);
    if (!roomClients) return;

    const presenceList = Array.from(roomClients.values()).map((c) => ({
      socketId: c.socketId,
      userId: c.userId,
      userName: c.userName,
      userAvatar: c.userAvatar,
      cursor: c.cursor,
      lastActive: c.lastActive,
    }));

    collabNamespace.to(`page:${pageId}`).emit("presence-list", {
      pageId,
      users: presenceList,
    });
  }

  return io;
}