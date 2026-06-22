"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

export default function DashboardPage() {
  const router = useRouter();
  const { data: workspaces, isLoading: loadingWorkspaces } = trpc.workspace.list.useQuery();
  const { data: currentWorkspace } = trpc.workspace.getCurrentWorkspace.useQuery();

  const workspaceId = currentWorkspace?.id;

  const { data: recentPages, isLoading: loadingRecent } = trpc.page.getRecent.useQuery(
    { limit: 12 },
    { enabled: !!workspaceId }
  );

  const createWorkspace = trpc.workspace.create.useMutation({
    onSuccess: (ws: { id: string }) => router.push(`/workspace/${ws.id}`),
  });

  const createPage = trpc.page.create.useMutation({
    onSuccess: (page: { id: string }) => {
      if (workspaceId) router.push(`/workspace/${workspaceId}/page/${page.id}`);
    },
  });

  if (loadingWorkspaces) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-tertiary text-sm">Loading¡­</div>
      </div>
    );
  }

  if (!workspaces || workspaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text-primary mb-2">
            Welcome to Mini Notion
          </h1>
          <p className="text-text-secondary text-sm max-w-md">
            Create a workspace to start organizing your pages and collaborating with your team.
          </p>
        </div>
        <button
          onClick={() => createWorkspace.mutateAsync({ name: "My Workspace", icon: "??" })}
          disabled={createWorkspace.isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-accent-text
            text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create your first workspace
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">
          {currentWorkspace?.icon} {currentWorkspace?.name}
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          {currentWorkspace?.memberCount} member{currentWorkspace?.memberCount !== 1 ? "s" : ""} ¡¤ {currentWorkspace?.pageCount} page{currentWorkspace?.pageCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => workspaceId && createPage.mutateAsync({ title: "Untitled" })}
          disabled={createPage.isPending || !workspaceId}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border-default
            text-sm text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New page
        </button>
        <Link
          href={`/settings/workspace/${workspaceId}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border-default
            text-sm text-text-primary hover:bg-bg-hover transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Settings
        </Link>
      </div>

      {/* Recent pages */}
      <section>
        <h2 className="text-sm font-medium text-text-tertiary uppercase tracking-wider mb-4">
          Recent pages
        </h2>
        {loadingRecent ? (
          <div className="text-sm text-text-tertiary py-4">Loading recent pages¡­</div>
        ) : recentPages && recentPages.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentPages.map((page: { id: string; title: string; icon: string | null; updatedAt: string }) => (
              <Link
                key={page.id}
                href={`/workspace/${workspaceId}/page/${page.id}`}
                className="group flex flex-col p-4 rounded-lg border border-border-default
                  hover:border-border-strong hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{page.icon ?? "??"}</span>
                  <h3 className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                    {page.title}
                  </h3>
                </div>
                <p className="text-xs text-text-tertiary">
                  Updated {new Date(page.updatedAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-sm text-text-tertiary py-4">
            No pages yet. Create your first page to get started.
          </div>
        )}
      </section>

      {/* Workspace switcher */}
      {workspaces.length > 1 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-text-tertiary uppercase tracking-wider mb-4">
            All workspaces
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {workspaces.map((ws: { id: string; name: string; icon: string | null; role: string; memberCount: number; pageCount: number }) => (
              <Link
                key={ws.id}
                href={`/workspace/${ws.id}`}
                className={`group flex items-center gap-3 p-4 rounded-lg border transition-all
                  ${ws.id === workspaceId
                    ? "border-accent bg-accent/5 shadow-sm"
                    : "border-border-default hover:border-border-strong hover:shadow-sm"}`}
              >
                <span className="text-2xl">{ws.icon ?? "??"}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-text-primary truncate">{ws.name}</h3>
                  <p className="text-xs text-text-tertiary">
                    {ws.memberCount} member{ws.memberCount !== 1 ? "s" : ""} ¡¤ {ws.pageCount} page{ws.pageCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="text-xs text-text-tertiary capitalize">{ws.role.toLowerCase()}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
