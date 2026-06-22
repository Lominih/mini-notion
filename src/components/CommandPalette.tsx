"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

interface CommandPaletteProps {
  workspaceId?: string;
}

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  keywords?: string[];
}

export function CommandPalette({ workspaceId }: CommandPaletteProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: searchResults } = trpc.page.search.useQuery(
    { workspaceId: workspaceId!, query, tags: [] },
    { enabled: !!workspaceId && isOpen && query.length >= 2 }
  );

  const { data: recentPages } = trpc.page.getRecent.useQuery(
    { workspaceId: workspaceId!, limit: 8 },
    { enabled: !!workspaceId && isOpen && query.length < 2 }
  );

  const createPage = trpc.page.create.useMutation();

  const quickActions: CommandItem[] = useMemo(() => {
    const actions: CommandItem[] = [
      {
        id: "create-page",
        label: "Create new page",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        ),
        action: async () => {
          if (!workspaceId) return;
          const page = await createPage.mutateAsync({ workspaceId, title: "Untitled" });
          router.push(`/workspace/${workspaceId}/page/${page.id}`);
          setIsOpen(false);
        },
        category: "Actions",
        keywords: ["new", "add", "page"],
      },
      {
        id: "create-workspace",
        label: "Create new workspace",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2Z" />
            <path d="M5 12h14" />
            <path d="M10 10v4" />
            <path d="M14 10v4" />
          </svg>
        ),
        action: () => {
          router.push("/workspace/new");
          setIsOpen(false);
        },
        category: "Actions",
        keywords: ["workspace", "team", "new"],
      },
      {
        id: "go-settings",
        label: "Go to settings",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
        action: () => {
          router.push("/settings");
          setIsOpen(false);
        },
        category: "Navigation",
        keywords: ["preferences", "config"],
      },
    ];

    if (workspaceId) {
      actions.push({
        id: "workspace-settings",
        label: "Workspace settings",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
        action: () => {
          router.push(`/settings/workspace/${workspaceId}`);
          setIsOpen(false);
        },
        category: "Navigation",
        keywords: ["members", "team", "workspace"],
      });
    }

    return actions;
  }, [workspaceId, createPage, router]);

  const allItems = useMemo(() => {
    const items: CommandItem[] = [];

    if (query.length < 2 && recentPages && recentPages.length > 0) {
      items.push(
        ...recentPages.map((page) => ({
          id: `recent-${page.id}`,
          label: page.title,
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          ),
          action: () => {
            router.push(`/workspace/${workspaceId}/page/${page.id}`);
            setIsOpen(false);
          },
          category: "Recent",
        }))
      );
    }

    if (searchResults && searchResults.length > 0) {
      items.push(
        ...searchResults.map((page) => ({
          id: `search-${page.id}`,
          label: page.title,
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          ),
          action: () => {
            router.push(`/workspace/${workspaceId}/page/${page.id}`);
            setIsOpen(false);
          },
          category: "Pages",
        }))
      );
    }

    const filtered = quickActions.filter((action) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        action.label.toLowerCase().includes(q) ||
        action.keywords?.some((k) => k.includes(q))
      );
    });
    items.push(...filtered);

    return items;
  }, [query, recentPages, searchResults, quickActions, router, workspaceId]);

  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of allItems) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [allItems]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) setQuery("");
  }, [isOpen]);

  const scrollIntoView = useCallback((index: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-command-item]");
    items[index]?.scrollIntoView({ block: "nearest" });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const total = allItems.length;
      if (total === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => {
            const next = (prev + 1) % total;
            scrollIntoView(next);
            return next;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => {
            const next = (prev - 1 + total) % total;
            scrollIntoView(next);
            return next;
          });
          break;
        case "Enter":
          e.preventDefault();
          allItems[selectedIndex]?.action();
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [allItems, selectedIndex, scrollIntoView]
  );

  if (!isOpen) return null;

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={() => setIsOpen(false)}
    >
      <div className="fixed inset-0 bg-bg-overlay" />
      <div
        className="relative w-full max-w-lg bg-bg-primary border border-border-default
          rounded-xl shadow-xl overflow-hidden"
        style={{ animation: "command-palette-in 0.15s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 border-b border-border-default">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-tertiary flex-shrink-0">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or type a command¡­"
            className="flex-1 h-12 bg-transparent text-text-primary text-sm outline-none placeholder:text-text-placeholder"
          />
          <kbd className="text-xs text-text-tertiary font-mono border border-border-default rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {allItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-tertiary">
              No results found
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  {category}
                </div>
                {items.map((item) => {
                  flatIndex++;
                  const idx = flatIndex;
                  return (
                    <button
                      key={item.id}
                      data-command-item
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center gap-3 w-full px-4 py-2 text-sm text-left transition-colors
                        ${idx === selectedIndex ? "bg-bg-hover text-text-primary" : "text-text-secondary hover:bg-bg-hover"}`}
                    >
                      <span className="flex-shrink-0 text-text-tertiary">
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {idx === selectedIndex && (
                        <kbd className="text-xs text-text-tertiary font-mono">
                          ?
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border-default text-xs text-text-tertiary">
          <span className="flex items-center gap-1">
            <kbd className="font-mono border border-border-default rounded px-1 py-0.5">¡ü¡ý</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono border border-border-default rounded px-1 py-0.5">?</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono border border-border-default rounded px-1 py-0.5">Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
