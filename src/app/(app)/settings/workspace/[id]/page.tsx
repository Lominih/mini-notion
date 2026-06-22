"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

const EMOJI_OPTIONS = ["??", "??", "??", "??", "??", "?", "??", "??", "??", "??", "???", "??"];

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const { data: workspace, isLoading, refetch } = trpc.workspace.getById.useQuery(
    { id: workspaceId },
    { enabled: !!workspaceId }
  );

  const updateWorkspace = trpc.workspace.update.useMutation({ onSuccess: () => refetch() });
  const deleteWorkspace = trpc.workspace.delete.useMutation({
    onSuccess: () => router.push("/"),
  });

  const [name, setName] = useState("");
  const [nameInitialized, setNameInitialized] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER" | "VIEWER">("MEMBER");

  const invite = trpc.member.invite.useMutation({
    onSuccess: () => {
      setInviteEmail("");
      refetch();
    },
  });

  const removeMember = trpc.member.remove.useMutation({ onSuccess: () => refetch() });
  const updateRole = trpc.member.updateRole.useMutation({ onSuccess: () => refetch() });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-tertiary text-sm">Loading workspace settings¡­</div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-text-secondary text-sm">Workspace not found.</p>
        <button onClick={() => router.push("/")} className="text-sm text-accent hover:text-accent-hover transition-colors">
          Go to dashboard
        </button>
      </div>
    );
  }

  if (!nameInitialized) {
    setName(workspace.name);
    setNameInitialized(true);
  }

  const handleSaveName = async () => {
    if (!name.trim()) return;
    await updateWorkspace.mutateAsync({ id: workspaceId, name: name.trim() });
  };

  const handleSetIcon = async (icon: string) => {
    await updateWorkspace.mutateAsync({ id: workspaceId, icon });
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    await invite.mutateAsync({
      workspaceId,
      email: inviteEmail.trim(),
      role: inviteRole,
    });
  };

  const handleRemoveMember = async (userId: string) => {
    if (confirm("Remove this member from the workspace?")) {
      await removeMember.mutateAsync({ workspaceId, userId });
    }
  };

  const handleDeleteWorkspace = async () => {
    if (confirm(`Delete "${workspace.name}" and all its pages? This cannot be undone.`)) {
      await deleteWorkspace.mutateAsync({ id: workspaceId });
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-2 mb-8">
        <button
          onClick={() => router.push(`/workspace/${workspaceId}`)}
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-2xl font-semibold text-text-primary">Workspace Settings</h1>
      </div>

      {/* General */}
      <section className="mb-10">
        <h2 className="text-lg font-medium text-text-primary mb-4">General</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Icon
            </label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleSetIcon(emoji)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center
                    transition-colors ${workspace.icon === emoji ? "bg-accent/10 ring-2 ring-accent" : "bg-bg-tertiary hover:bg-bg-hover"}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Workspace name
            </label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleSaveName}
                className="flex-1 px-3 py-2 rounded-lg border border-border-default bg-bg-primary
                  text-text-primary text-sm outline-none focus:border-border-focus transition-colors"
              />
            </div>
            {updateWorkspace.isSuccess && (
              <p className="text-xs text-success mt-1">Saved</p>
            )}
          </div>
        </div>
      </section>

      {/* Members */}
      <section className="mb-10">
        <h2 className="text-lg font-medium text-text-primary mb-4">Members</h2>

        {/* Invite form */}
        <form onSubmit={handleInvite} className="flex gap-2 mb-4">
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email address"
            type="email"
            required
            className="flex-1 px-3 py-2 rounded-lg border border-border-default bg-bg-primary
              text-text-primary text-sm outline-none focus:border-border-focus transition-colors"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "MEMBER" | "VIEWER")}
            className="px-3 py-2 rounded-lg border border-border-default bg-bg-primary
              text-text-primary text-sm outline-none focus:border-border-focus"
          >
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <button
            type="submit"
            disabled={invite.isPending}
            className="px-4 py-2 rounded-lg bg-accent text-accent-text text-sm font-medium
              hover:bg-accent-hover transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {invite.isPending ? "Inviting¡­" : "Invite"}
          </button>
        </form>
        {invite.isSuccess && (
          <p className="text-sm text-success mb-4">Invitation sent successfully</p>
        )}
        {invite.isError && (
          <p className="text-sm text-error mb-4">{invite.error.message}</p>
        )}

        {/* Members list */}
        <div className="space-y-2">
          {workspace.members?.map((member: {
            id: string;
            role: string;
            user: { id: string; name: string | null; email: string; image: string | null };
          }) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border-default"
            >
              <div className="w-9 h-9 rounded-full bg-bg-tertiary flex items-center justify-center text-sm font-medium text-text-secondary overflow-hidden">
                {member.user.image ? (
                  <img src={member.user.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  (member.user.name ?? member.user.email)[0]?.toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {member.user.name ?? "Unnamed"}
                </p>
                <p className="text-xs text-text-tertiary truncate">{member.user.email}</p>
              </div>
              <select
                value={member.role}
                onChange={(e) =>
                  updateRole.mutateAsync({
                    workspaceId,
                    userId: member.user.id,
                    role: e.target.value as "ADMIN" | "MEMBER" | "VIEWER",
                  })
                }
                disabled={member.role === "OWNER"}
                className="px-2 py-1 rounded border border-border-default bg-bg-primary
                  text-xs text-text-secondary outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
              {member.role !== "OWNER" && (
                <button
                  onClick={() => handleRemoveMember(member.user.id)}
                  className="text-xs text-text-tertiary hover:text-error transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="text-lg font-medium text-error mb-4">Danger Zone</h2>
        <div className="p-4 rounded-lg border border-error/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Delete workspace</p>
              <p className="text-xs text-text-tertiary mt-0.5">
                Permanently delete this workspace and all its pages.
              </p>
            </div>
            <button
              onClick={handleDeleteWorkspace}
              disabled={deleteWorkspace.isPending}
              className="px-4 py-2 rounded-lg border border-error text-error text-sm font-medium
                hover:bg-error/10 transition-colors disabled:opacity-50"
            >
              {deleteWorkspace.isPending ? "Deleting¡­" : "Delete workspace"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
