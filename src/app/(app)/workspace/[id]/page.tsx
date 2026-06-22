"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { PageTree } from "@/components/PageTree";

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const { data: workspace, isLoading } = trpc.workspace.getById.useQuery(
    { id: workspaceId },
    { enabled: !!workspaceId }
  );

  const { data: recentPages } = trpc.page.getRecent.useQuery(
    { limit: 6 },
    { enabled: !!workspaceId }
  );

  const { data: favorites } = trpc.page.getFavorites.useQuery(
    undefined,
    { enabled: !!workspaceId }
  );

  const createPage = trpc.page.create.useMutation({
    onSuccess: (page: { id: string }) => router.push(`/workspace/${workspaceId}/page/${page.id}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-tertiary text-sm">Loading workspace¡­</div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-text-secondary text-sm">Workspace not found or you lack access.</p>
        <button
          onClick={() => router.push("/")}
          className="text-sm text-accent hover:text-accent-hover transition-colors"
        >
          Go to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Workspace page tree panel */}
      <div className="hidden md:flex flex-col w-60 border-r border-border-default bg-sidebar-bg overflow-y-auto">
        <div className="px-3 py-3 border-b border-border-default">
          <div className="flex items-center gap-2">
            <span className="text-lg">{workspace.icon ?? "??"}</span>
            <h2 className="text-sm font-semibold text-text-primary truncate">
              {workspace.name}
            </h2>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          <PageTree workspaceId={workspaceId} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">
                {workspace.icon} {workspace.name}
              </h1>
              <p className="text-text-secondary text-sm mt-1">
                {workspace.members?.length ?? 0} member{(workspace.members?.length ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={() => createPage.mutateAsync({ title: "Untitled" })}
              disabled={createPage.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-text
                text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New page
            </button>
          </div>

          {/* Favorites */}
          {favorites && favorites.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-medium text-text-tertiary uppercase tracking-wider mb-3">
                Favorites
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {favorites.map((fav: { id: string; title: string; icon: string | null }) => (
                  <a
                    key={fav.id}
                    href={`/workspace/${workspaceId}/page/${fav.id}`}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border-default
                      hover:border-border-strong hover:shadow-sm transition-all text-sm"
                  >
                    <span className="text-base">{fav.icon ?? "??"}</span>
                    <span className="text-text-primary font-medium truncate">{fav.title}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Recent pages */}
          <section>
            <h2 className="text-sm font-medium text-text-tertiary uppercase tracking-wider mb-3">
              Recent pages
            </h2>
            {recentPages && recentPages.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentPages.map((page: { id: string; title: string; icon: string | null; updatedAt: string }) => (
                  <a
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
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-sm text-text-tertiary py-4">
                No pages yet. Create your first page to get started.
              </div>
            )}
          </section>

          {/* Members */}
          {workspace.members && workspace.members.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-medium text-text-tertiary uppercase tracking-wider mb-3">
                Members
              </h2>
              <div className="space-y-2">
                {workspace.members.map((member: {
                  id: string;
                  role: string;
                  user: { id: string; name: string | null; email: string; image: string | null };
                }) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-2 rounded-lg"
                  >
                    <div className="w-8 h-8 rounded-full bg-bg-tertiary flex items-center justify-center text-xs font-medium text-text-secondary overflow-hidden">
                      {member.user.image ? (
                        <img src={member.user.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (member.user.name ?? member.user.email)[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">
                        {member.user.name ?? member.user.email}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {member.user.email}
                      </p>
                    </div>
                    <span className="text-xs text-text-tertiary capitalize">
                      {member.role.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
