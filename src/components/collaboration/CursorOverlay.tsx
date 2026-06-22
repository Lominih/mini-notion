"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Props for CursorOverlay.
 */

interface CursorUser {
  userId: string;
  userName: string;
  userAvatar?: string;
  cursor: { anchor: number; head: number } | null;
  color: string;
}

interface CursorOverlayProps {
  /** List of remote users with cursor positions */
  users: CursorUser[];
  /** Reference to the editor container element */
  editorRef: React.RefObject<HTMLElement | null>;
  /** Inactivity timeout before hiding cursors (ms) */
  hideAfterMs?: number;
}

const USER_COLORS = [
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
  "#6366F1",
  "#14B8A6",
];

const COLOR_MAP = new Map<string, string>();
let colorIndex = 0;

function getUserColor(userId: string): string {
  if (COLOR_MAP.has(userId)) return COLOR_MAP.get(userId)!;

  const color = USER_COLORS[colorIndex % USER_COLORS.length];
  COLOR_MAP.set(userId, color);
  colorIndex++;
  return color;
}

/**
 * Overlay that renders other users' cursors and name labels
 * on top of the editor. Cursors hide after a period of inactivity.
 */
export function CursorOverlay({
  users,
  editorRef,
  hideAfterMs = 10_000,
}: CursorOverlayProps) {
  const [visibleCursors, setVisibleCursors] = useState<
    (CursorUser & { position: { top: number; left: number } | null; active: boolean })[]
  >([]);

  const updateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Convert cursor anchor positions to pixel coordinates.
   * Uses a simple heuristic based on line height and character width.
   */
  const computeCursorPosition = useCallback(
    (cursor: { anchor: number; head: number } | null): { top: number; left: number } | null => {
      const editor = editorRef.current;
      if (!editor || !cursor) return null;

      const lines = editor.textContent?.split("\n") ?? [];
      let charCount = 0;
      let lineIndex = 0;
      let colIndex = 0;

      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length >= cursor.anchor) {
          lineIndex = i;
          colIndex = cursor.anchor - charCount;
          break;
        }
        charCount += lines[i].length + 1; // +1 for newline
        if (i === lines.length - 1) {
          lineIndex = i;
          colIndex = lines[i].length;
        }
      }

      const lineHeight = 24; // approximate line height in px
      const charWidth = 8;   // approximate character width in px

      return {
        top: lineIndex * lineHeight,
        left: colIndex * charWidth,
      };
    },
    [editorRef],
  );

  useEffect(() => {
    const now = Date.now();

    const updated = users
      .filter((u) => u.cursor !== null)
      .map((user) => ({
        ...user,
        color: user.color || getUserColor(user.userId),
        position: computeCursorPosition(user.cursor),
        active: now - (user as unknown as { lastActive?: number }).lastActive! < hideAfterMs,
      }));

    setVisibleCursors(updated);
  }, [users, hideAfterMs, computeCursorPosition]);

  // Periodic re-check for inactivity
  useEffect(() => {
    updateTimerRef.current = setInterval(() => {
      const now = Date.now();
      setVisibleCursors((prev) =>
        prev.map((c) => ({
          ...c,
          active: now - (c as unknown as { lastActive?: number }).lastActive! < hideAfterMs,
        })),
      );
    }, 2000);

    return () => {
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
      }
    };
  }, [hideAfterMs]);

  if (visibleCursors.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-50 overflow-hidden"
      aria-hidden="true"
    >
      {visibleCursors.map((cursor) => {
        if (!cursor.position || !cursor.active) return null;

        return (
          <div
            key={cursor.userId}
            className="absolute transition-all duration-150 ease-out"
            style={{
              top: cursor.position.top,
              left: cursor.position.left,
            }}
          >
            {/* Cursor line */}
            <div
              className="w-0.5 h-6 rounded-full"
              style={{ backgroundColor: cursor.color }}
            />

            {/* Name label */}
            <div
              className="absolute -top-6 left-0 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.userName}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { getUserColor };