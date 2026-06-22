"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { BlockEditor } from "@/components/editor";

export default function PageEditorPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const pageId = params.pageId as string;

  const [title, setTitle] = useState("");
  const [titleInitialized, setTitleInitialized] = useState(false);

  const { data: page, isLoading } = trpc.page.getById.useQuery(
    { workspaceId, id: pageId },
    {
      enabled: !!workspaceId && !!pageId,
      onSuccess: (data) => {
        if (!titleInitialized) {
          setTitle(data.title);
          setTitleInitialized(true);
        }
      },
    }
  );

  const updatePage = trpc.page.update.useMutation();
  const deletePage = trpc.page.delete.useMutation({
    onSuccess: () => router.push(`/workspace/${workspaceId}`),
  });

  const handleSaveContent = useCallback(
    (content: string) => {
      updatePage.mutateAsync({ workspaceId, id: pageId, content });
    },
    [updatePage, workspaceId, pageId]
  );

  const handleTitleChange = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const newTitle = e.target.value.trim() || "Untitled";
      if (newTitle !== page?.title) {
        updatePage.mutateAsync({ workspaceId, id: pageId, title: newTitle });
      }
    },
    [updatePage, workspaceId, pageId, page?.title]
  );

  const handleDelete = async () => {
    if (confirm("Delete this page and all its sub-pages?")) {
      await deletePage.mutateAsync({ workspaceId, id: pageId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-tertiary text-sm">Loading page¡­</div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-text-secondary text-sm">Page not found.</p>
        <Link
          href={`/workspace/${workspaceId}`}
          className="text-sm text-accent hover:text-accent-hover transition-colors"
        >
          Back to workspace
        </Link>
      </div>
    );
  }

  const content = (() => {
    if (!page.content) return "[]";
    if (typeof page.content === "string") return page.content;
    return JSON.stringify(page.content);
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center h-11 px-4 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm gap-2 flex-shrink-0">
        <Link
          href={`/workspace/${workspaceId}`}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {page.parent?.title ?? "Workspace"}
        </Link>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-tertiary">
          <path d="M4.5 2.5L8 6L4.5 9.5" />
        </svg>
        <span className="text-sm text-text-primary truncate max-w-xs">
          {page.icon ? <span className="mr-1">{page.icon}</span> : null}
          {page.title}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-text-tertiary
              hover:text-error hover:bg-bg-hover transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            Delete
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
          {/* Page icon */}
          <button className="text-4xl mb-2 hover:bg-bg-hover rounded p-1 transition-colors">
            {page.icon ?? "??"}
          </button>

          {/* Title */}
          <input
            defaultValue={page.title}
            onBlur={handleTitleChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder="Untitled"
            className="w-full text-4xl font-bold text-text-primary bg-transparent
              border-none outline-none placeholder:text-text-tertiary mb-6"
          />

          {/* Block editor */}
          <div className="min-h-[50vh]">
            <BlockEditor
              initialContent={content}
              onSave={handleSaveContent}
              placeholder="Start writing, or type '/' for commands¡­"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
