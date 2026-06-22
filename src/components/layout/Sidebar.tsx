"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { PageTree } from "@/components/PageTree";
import { ThemeToggle } from "@/components/ThemeToggle";

interface SidebarProps {
  workspaceId?: string;
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ workspaceId, isOpen, onToggle }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);

  const { data: workspaces } = trpc.workspace.list.useQuery();
  const { data: recentPages } = trpc.page.getRecent.useQuery(
    { workspaceId: workspaceId!, limit: 5 },
    { enabled: !!workspaceId }
  );
  const { data: favorites } = trpc.page.getFavorites.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  const currentWorkspace = workspaces?.find((w) => w.id === workspaceId);

  const createPage = trpc.page.create.useMutation({
    onSuccess: (page) => {
      router.push(`/workspace/${workspaceId}/page/${page.id}`);
    },
  });

  const handleNewPage = async () => {
    if (!workspaceId) return;
    await createPage.mutateAsync({ workspaceId, title: "Untitled" });
  };

  const handleSearchToggle = useCallback(() => {
    setShowSearch((prev) => !prev);
  }, []);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("open-command-palette"));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        handleSearchToggle();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleSearchToggle]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        workspaceDropdownRef.current &&
        !workspaceDropdownRef.current.contains(e.target as Node)
      ) {
        setShowWorkspaces(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isFavorites = favorites && favorites.length > 0;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-bg-overlay z-30 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 h-full bg-sidebar-bg
          border-r border-border-default flex flex-col
          transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:relative lg:translate-x-0 lg:z-auto`}
        style={{ width: "var(--sidebar-width)" }}
      >
        {/* Workspace selector */}
        <div className="flex items-center justify-between h-11 px-3 border-b border-border-default">
          <div className="relative" ref={workspaceDropdownRef}>
            <button
              onClick={() => setShowWorkspaces(!showWorkspaces)}
              className="flex items-center gap-2 px-1.5 py-1 rounded-md
                hover:bg-sidebar-hover transition-colors text-sm font-medium
                text-sidebar-text max-w-[180px]"
            >
              <span className="text-base">
                {currentWorkspace?.icon ?? "??"}
              </span>
              <span className="truncate">{currentWorkspace?.name ?? "Select workspace"}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className={`flex-shrink-0 transition-transform ${showWorkspaces ? "rotate-180" : ""}`}>
                <path d="M3 4.5L6 7.5L9 4.5" />
              </svg>
            </button>

            {showWorkspaces && workspaces && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-bg-primary border border-border-default rounded-lg shadow-lg z-50 py-1">
                <div className="px-3 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Workspaces
                </div>
                {workspaces.map((ws) => (
                  <Link
                    key={ws.id}
                    href={`/workspace/${ws.id}`}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm
                      transition-colors
                      ${ws.id === workspaceId ? "bg-bg-active text-text-primary font-medium" : "text-text-primary hover:bg-bg-hover"}`}
                    onClick={() => setShowWorkspaces(false)}
                  >
                    <span className="text-base">{ws.icon ?? "??"}</span>
                    <span className="truncate">{ws.name}</span>
                    <span className="ml-auto text-xs text-text-tertiary">
                      {ws.role}
                    </span>
                  </Link>
                ))}
                <div className="border-t border-border-default mt-1 pt-1">
                  <Link
                    href="/workspace/new"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover transition-colors"
                    onClick={() => setShowWorkspaces(false)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Create workspace
                  </Link>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onToggle}
            className="w-7 h-7 flex items-center justify-center rounded-md
              text-text-secondary hover:bg-sidebar-hover hover:text-text-primary
              transition-colors lg:hidden"
            aria-label="Close sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={handleSearchToggle}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md
              text-sm text-text-secondary bg-bg-tertiary hover:bg-bg-hover
              transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span>Search</span>
            <kbd className="ml-auto text-xs text-text-tertiary font-mono">
              ?K
            </kbd>
          </button>
        </div>

        {/* Quick actions */}
        <div className="px-3 py-1">
          <button
            onClick={handleNewPage}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md
              text-sm text-text-secondary hover:bg-sidebar-hover hover:text-text-primary
              transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New page
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-1">
          {/* Favorites */}
          {isFavorites && (
            <div className="py-1">
              <div className="flex items-center px-2 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary px-1">
                  Favorites
                </span>
              </div>
              {favorites!.map((fav: { id: string; title: string; icon: string | null }) => (
                <Link
                  key={fav.id}
                  href={`/workspace/${workspaceId}/page/${fav.id}`}
                  className={`flex items-center gap-2 h-7 px-2 rounded-md text-sm truncate
                    transition-colors
                    ${pathname?.includes(fav.id) ? "bg-sidebar-active text-sidebar-text font-medium" : "text-sidebar-text hover:bg-sidebar-hover"}`}
                >
                  {fav.icon ? (
                    <span className="text-base leading-none">{fav.icon}</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 text-text-tertiary">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  )}
                  <span className="truncate">{fav.title}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Recent pages */}
          {recentPages && recentPages.length > 0 && (
            <div className="py-1">
              <div className="flex items-center px-2 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary px-1">
                  Recent
                </span>
              </div>
              {recentPages.map((page) => (
                <Link
                  key={page.id}
                  href={`/workspace/${workspaceId}/page/${page.id}`}
                  className={`flex items-center gap-2 h-7 px-2 rounded-md text-sm truncate
                    transition-colors
                    ${pathname?.includes(page.id) ? "bg-sidebar-active text-sidebar-text font-medium" : "text-sidebar-text hover:bg-sidebar-hover"}`}
                >
                  {page.icon ? (
                    <span className="text-base leading-none">{page.icon}</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 text-text-tertiary">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  )}
                  <span className="truncate">{page.title}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Page tree */}
          {workspaceId && <PageTree workspaceId={workspaceId} />}
        </div>

        {/* Footer */}
        <div className="border-t border-border-default px-2 py-2 flex items-center justify-between">
          <Link
            href="/settings"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm
              text-text-secondary hover:bg-sidebar-hover hover:text-text-primary
              transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Settings
          </Link>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
