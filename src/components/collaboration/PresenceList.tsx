"use client";

import { useState } from "react";
import { getUserColor } from "./CursorOverlay";

/**
 * Props for PresenceList.
 */

interface PresenceUser {
  userId: string;
  userName: string;
  userAvatar?: string;
  lastActive: number;
}

interface PresenceListProps {
  /** All remote users currently viewing/editing the page */
  users: PresenceUser[];
  /** Current user ID (to exclude from list or mark differently) */
  currentUserId: string;
  /** How long before a user is considered inactive (ms) */
  inactiveThresholdMs?: number;
}

/**
 * Shows the list of users currently viewing/editing a page.
 * Displays online indicators and user avatars.
 */
export function PresenceList({
  users,
  currentUserId,
  inactiveThresholdMs = 30_000,
}: PresenceListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const now = Date.now();
  const activeUsers = users.filter((u) => u.userId !== currentUserId);

  // Separate active from inactive
  const onlineUsers = activeUsers.filter(
    (u) => now - u.lastActive < inactiveThresholdMs,
  );
  const offlineUsers = activeUsers.filter(
    (u) => now - u.lastActive >= inactiveThresholdMs,
  );

  const totalVisible = onlineUsers.length + offlineUsers.length;

  if (totalVisible === 0) return null;

  return (
    <div className="relative">
      {/* Collapsed: avatar stack with count */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-1 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        title={`${onlineUsers.length} online, ${offlineUsers.length} idle`}
      >
        {/* Avatar stack */}
        <div className="flex -space-x-2">
          {onlineUsers.slice(0, 5).map((user) => (
            <div
              key={user.userId}
              className="relative h-6 w-6 rounded-full border-2 border-white dark:border-zinc-900"
              style={{ backgroundColor: getUserColor(user.userId) }}
            >
              {user.userAvatar ? (
                <img
                  src={user.userAvatar}
                  alt={user.userName}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white">
                  {user.userName.charAt(0).toUpperCase()}
                </span>
              )}
              {/* Online dot */}
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white bg-green-500 dark:border-zinc-900" />
            </div>
          ))}
          {onlineUsers.length > 5 && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-zinc-300 text-[10px] font-bold text-zinc-700 dark:border-zinc-900 dark:bg-zinc-600 dark:text-zinc-200">
              +{onlineUsers.length - 5}
            </div>
          )}
        </div>

        <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
          {onlineUsers.length}
        </span>
      </button>

      {/* Expanded: full user list */}
      {isExpanded && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {/* Online section */}
          {onlineUsers.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                Online — {onlineUsers.length}
              </p>
              {onlineUsers.map((user) => (
                <UserRow key={user.userId} user={user} isOnline />
              ))}
            </div>
          )}

          {/* Offline section */}
          {offlineUsers.length > 0 && (
            <div>
              <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                Idle — {offlineUsers.length}
              </p>
              {offlineUsers.map((user) => (
                <UserRow key={user.userId} user={user} isOnline={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserRow({ user, isOnline }: { user: PresenceUser; isOnline: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800">
      {/* Avatar */}
      <div className="relative">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: getUserColor(user.userId) }}
        >
          {user.userAvatar ? (
            <img
              src={user.userAvatar}
              alt={user.userName}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            user.userName.charAt(0).toUpperCase()
          )}
        </div>
        {/* Status dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-zinc-900 ${
            isOnline ? "bg-green-500" : "bg-zinc-400"
          }`}
        />
      </div>

      {/* Name */}
      <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
        {user.userName}
      </span>

      {/* Status label */}
      <span className="text-xs text-zinc-400">
        {isOnline ? "Editing" : "Idle"}
      </span>
    </div>
  );
}