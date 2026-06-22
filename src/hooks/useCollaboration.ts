"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Doc, applyUpdate, encodeStateAsUpdate } from "yjs";
import { io, Socket } from "socket.io-client";

/**
 * Awareness state for a remote user.
 */
export interface RemoteUser {
  socketId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  cursor: { anchor: number; head: number } | null;
  lastActive: number;
}

export interface CollaborationOptions {
  pageId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  serverUrl?: string;
}

export interface CollaborationState {
  /** The shared Y.Doc instance */
  doc: Doc | null;
  /** Whether connected to the collaboration server */
  isConnected: boolean;
  /** List of remote users in the same room */
  remoteUsers: RemoteUser[];
  /** Apply a local update to the Y.Doc */
  applyLocalUpdate: (update: Uint8Array) => void;
  /** Send awareness (cursor position) update */
  updateAwareness: (cursor: { anchor: number; head: number } | null) => void;
  /** The Socket.IO instance */
  socket: Socket | null;
}

/**
 * React hook for real-time collaboration via Yjs + Socket.IO.
 *
 * Usage:
 *   const { doc, isConnected, remoteUsers, applyLocalUpdate, updateAwareness } = useCollaboration({
 *     pageId: "abc123",
 *     userId: "user-1",
 *     userName: "Alice",
 *   });
 */
export function useCollaboration(options: CollaborationOptions): CollaborationState {
  const { pageId, userId, userName, userAvatar, serverUrl = "" } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);

  const docRef = useRef<Doc | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const awarenessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Initialize Doc + Socket ──────────────────────
  useEffect(() => {
    if (!pageId || !userId) return;

    // Create local Y.Doc
    const doc = new Doc();
    docRef.current = doc;

    // Connect to collaboration server
    const socket = io(`${serverUrl}/collab`, {
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
    socketRef.current = socket;

    // ── Socket Events ────────────────────────────
    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join-room", { pageId, userId, userName, userAvatar });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Receive synced document state from server
    socket.on("yjs-sync-response", (data: { pageId: string; state: number[] }) => {
      if (data.pageId !== pageId) return;

      const state = new Uint8Array(data.state);
      applyUpdate(doc, state, "remote-sync");
    });

    // Receive individual updates from other clients
    socket.on(
      "yjs-update",
      (data: { pageId: string; update: number[]; senderId: string }) => {
        if (data.pageId !== pageId) return;
        if (data.senderId === socket.id) return; // skip own echo

        const update = new Uint8Array(data.update);
        applyUpdate(doc, update, "remote");
      },
    );

    // Receive awareness updates
    socket.on(
      "yjs-awareness",
      (data: {
        pageId: string;
        socketId: string;
        awareness: RemoteUser;
      }) => {
        if (data.pageId !== pageId) return;

        setRemoteUsers((prev) => {
          const idx = prev.findIndex((u) => u.socketId === data.socketId);
          const updated: RemoteUser = {
            ...data.awareness,
            socketId: data.socketId,
          };

          if (idx >= 0) {
            const next = [...prev];
            next[idx] = updated;
            return next;
          }
          return [...prev, updated];
        });
      },
    );

    // Handle user leaving
    socket.on("user-left", (data: { pageId: string; socketId: string }) => {
      if (data.pageId !== pageId) return;
      setRemoteUsers((prev) => prev.filter((u) => u.socketId !== data.socketId));
    });

    // Presence list (full refresh)
    socket.on(
      "presence-list",
      (data: { pageId: string; users: RemoteUser[] }) => {
        if (data.pageId !== pageId) return;
        setRemoteUsers(data.users.filter((u) => u.userId !== userId));
      },
    );

    // ── Local Doc → Server ────────────────────────
    const docUpdateHandler = (update: Uint8Array, origin: unknown) => {
      // Don't send back remote updates
      if (origin === "remote" || origin === "remote-sync") return;

      socket.emit("yjs-update", {
        pageId,
        update: Array.from(update),
      });
    };
    doc.on("update", docUpdateHandler);

    // Connect
    socket.connect();

    // ── Cleanup ──────────────────────────────────
    return () => {
      doc.off("update", docUpdateHandler);

      socket.emit("leave-room", { pageId });
      socket.disconnect();

      doc.destroy();

      docRef.current = null;
      socketRef.current = null;
      setIsConnected(false);
      setRemoteUsers([]);

      if (awarenessTimerRef.current) {
        clearTimeout(awarenessTimerRef.current);
        awarenessTimerRef.current = null;
      }
    };
  }, [pageId, userId, userName, userAvatar, serverUrl]);

  // ── Apply Local Update ─────────────────────────
  const applyLocalUpdate = useCallback(
    (update: Uint8Array) => {
      const doc = docRef.current;
      if (!doc) return;

      applyUpdate(doc, update, "local");
    },
    [],
  );

  // ── Send Awareness ─────────────────────────────
  const updateAwareness = useCallback(
    (cursor: { anchor: number; head: number } | null) => {
      const socket = socketRef.current;
      if (!socket || !pageId) return;

      socket.emit("yjs-awareness", {
        pageId,
        awareness: {
          userId,
          userName,
          userAvatar,
          cursor,
          lastActive: Date.now(),
        },
      });
    },
    [pageId, userId, userName, userAvatar],
  );

  return {
    doc: docRef.current,
    isConnected,
    remoteUsers,
    applyLocalUpdate,
    updateAwareness,
    socket: socketRef.current,
  };
}