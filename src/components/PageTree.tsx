"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc";

interface PageNode {
  id: string;
  title: string;
  icon: string | null;
  parentId: string | null;
  order: number;
  children?: PageNode[];
}

interface PageTreeProps {
  workspaceId: string;
}

interface ContextMenuState {
  pageId: string;
  x: number;
  y: number;
}

export function PageTree({ workspaceId }: PageTreeProps) {
  const pathname = usePathname();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`expanded-pages-${workspaceId}`);
      if (stored) {
        try {
          return new Set(JSON.parse(stored));
        } catch { /* ignore */ }
      }
    }
    return new Set();
  });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const { data: pages, refetch } = trpc.page.getTree.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const createPage = trpc.page.create.useMutation({
    onSuccess: () => refetch(),
  });

  const deletePage = trpc.page.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const updatePage = trpc.page.update.useMutation({
    onSuccess: () => refetch(),
  });

  const duplicatePage = trpc.page.duplicate.useMutation({
    onSuccess: () => refetch(),
  });

  useEffect(() => {
    localStorage.setItem(
      `expanded-pages-${workspaceId}`,
      JSON.stringify([...expandedIds])
    );
  }, [expandedIds, workspaceId]);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const toggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleNewPage = async (parentId?: string) => {
    const result = await createPage.mutateAsync({
      workspaceId,
      title: "Untitled",
      parentId: parentId ?? null,
    });
    if (parentId) {
      setExpandedIds((prev) => new Set(prev).add(parentId));
    }
    return result;
  };

  const handleContextMenu = (e: React.MouseEvent, pageId: string) => {
    e.preventDefault();
    setContextMenu({ pageId, x: e.clientX, y: e.clientY });
  };

  const startRename = (pageId: string, currentTitle: string) => {
    setRenamingId(pageId);
    setRenameValue(currentTitle);
    setContextMenu(null);
  };

  const commitRename = async () => {
    if (renamingId && renameValue.trim()) {
      await updatePage.mutateAsync({
        workspaceId,
        id: renamingId,
        title: renameValue.trim(),
      });
    }
    setRenamingId(null);
  };

  const handleDelete = async (pageId: string) => {
    setContextMenu(null);
    await deletePage.mutateAsync({ workspaceId, id: pageId });
  };

  const handleDuplicate = async (pageId: string) => {
    setContextMenu(null);
    await duplicatePage.mutateAsync({ workspaceId, id: pageId });
  };

  const renderNode = (node: PageNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isActive = pathname?.includes(node.id);

    return (
      <div key={node.id}>
        <div
          className={`group flex items-center h-7 pr-2 rounded-md cursor-pointer
            transition-colors duration-75
            ${isActive ? "bg-sidebar-active text-sidebar-text font-medium" : "text-sidebar-text hover:bg-sidebar-hover"}`}
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
        >
          <button
            onClick={() => toggle(node.id)}
            className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-sm
              hover:bg-sidebar-hover transition-transform duration-100
              ${hasChildren ? "visible" : "invisible"}`}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className={`transition-transform duration-100 ${isExpanded ? "rotate-90" : ""}`}
            >
              <path d="M4.5 2.5L8 6L4.5 9.5" />
            </svg>
          </button>

          <Link
            href={`/workspace/${workspaceId}/page/${node.id}`}
            className="flex-1 flex items-center gap-1.5 px-1 py-0.5 rounded text-sm truncate min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            {node.icon ? (
              <span className="text-base leading-none">{node.icon}</span>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-text-tertiary">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            )}
            {renamingId === node.id ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setRenamingId(null);
                }}
                className="flex-1 bg-bg-primary border border-border-focus rounded px-1 text-sm min-w-0 outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate">{node.title || "Untitled"}</span>
            )}
          </Link>

          <button
            onClick={(e) => handleContextMenu(e, node.id)}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-sm
              opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-primary
              hover:bg-sidebar-hover transition-opacity"
            aria-label="More actions"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
        </div>

        {isExpanded && hasChildren && (
          <div>
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const tree = (pages as PageNode[] | undefined) ?? [];

  return (
    <div className="py-1">
      <div className="flex items-center justify-between px-2 mb-1">
        <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary px-1">
          Pages
        </span>
        <button
          onClick={() => handleNewPage()}
          className="w-5 h-5 flex items-center justify-center rounded-sm
            text-text-tertiary hover:text-text-primary hover:bg-sidebar-hover
            transition-colors"
          aria-label="New page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
      <div>{tree.map((node) => renderNode(node))}</div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          pageId={contextMenu.pageId}
          onRename={(id, title) => startRename(id, title)}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onNewSubpage={(id) => handleNewPage(id)}
          onClose={() => setContextMenu(null)}
          pages={tree}
        />
      )}
    </div>
  );
}

interface ContextMenuProps {
  x: number;
  y: number;
  pageId: string;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNewSubpage: (id: string) => void;
  onClose: () => void;
  pages: PageNode[];
}

function findPage(pages: PageNode[], id: string): PageNode | null {
  for (const p of pages) {
    if (p.id === id) return p;
    if (p.children) {
      const found = findPage(p.children, id);
      if (found) return found;
    }
  }
  return null;
}

function ContextMenu({
  x,
  y,
  pageId,
  onRename,
  onDuplicate,
  onDelete,
  onNewSubpage,
  onClose,
  pages,
}: ContextMenuProps) {
  const page = findPage(pages, pageId);

  return (
    <div
      className="context-menu"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="context-menu-item"
        onClick={() => {
          if (page) onRename(pageId, page.title);
          onClose();
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
        Rename
      </button>
      <button
        className="context-menu-item"
        onClick={() => onNewSubpage(pageId)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add sub-page
      </button>
      <button
        className="context-menu-item"
        onClick={() => onDuplicate(pageId)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect width="14" height="14" x="8" y="8" rx="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
        Duplicate
      </button>
      <div className="context-menu-divider" />
      <button
        className="context-menu-item danger"
        onClick={() => onDelete(pageId)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          <line x1="10" x2="10" y1="11" y2="17" />
          <line x1="14" x2="14" y1="11" y2="17" />
        </svg>
        Delete
      </button>
    </div>
  );
}
