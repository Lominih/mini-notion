"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

export default function SettingsPage() {
  const router = useRouter();
  const { data: user, isLoading } = trpc.user.getMe.useQuery();
  const updateProfile = trpc.user.updateProfile.useMutation();
  const changePassword = trpc.user.changePassword.useMutation();
  const deleteAccount = trpc.user.deleteAccount.useMutation({
    onSuccess: () => {
      localStorage.removeItem("access_token");
      router.push("/auth/login");
    },
  });

  const [name, setName] = useState("");
  const [nameInitialized, setNameInitialized] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-tertiary text-sm">Loading settings¡­</div>
      </div>
    );
  }

  if (!user) {
    router.push("/auth/login");
    return null;
  }

  if (!nameInitialized) {
    setName(user.name ?? "");
    setNameInitialized(true);
  }

  const handleSaveProfile = async () => {
    if (!name.trim()) return;
    await updateProfile.mutateAsync({ name: name.trim() });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordError("Current password is incorrect");
    }
  };

  const handleDeleteAccount = async () => {
    if (confirm("Are you sure you want to delete your account? This cannot be undone.")) {
      await deleteAccount.mutateAsync();
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-text-primary mb-8">Settings</h1>

      {/* Profile */}
      <section className="mb-10">
        <h2 className="text-lg font-medium text-text-primary mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveProfile}
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-bg-primary
                text-text-primary text-sm outline-none focus:border-border-focus transition-colors"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Email
            </label>
            <input
              value={user.email}
              disabled
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-bg-tertiary
                text-text-tertiary text-sm cursor-not-allowed"
            />
            <p className="text-xs text-text-tertiary mt-1">Email cannot be changed</p>
          </div>
          {user.image && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Avatar
              </label>
              <img src={user.image} alt="" className="w-16 h-16 rounded-full" />
            </div>
          )}
          {updateProfile.isSuccess && (
            <p className="text-sm text-success">Profile updated successfully</p>
          )}
        </div>
      </section>

      {/* Password */}
      <section className="mb-10">
        <h2 className="text-lg font-medium text-text-primary mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Current password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-bg-primary
                text-text-primary text-sm outline-none focus:border-border-focus transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              New password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-bg-primary
                text-text-primary text-sm outline-none focus:border-border-focus transition-colors"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-bg-primary
                text-text-primary text-sm outline-none focus:border-border-focus transition-colors"
              required
              minLength={8}
            />
          </div>
          {passwordError && (
            <p className="text-sm text-error">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="text-sm text-success">Password changed successfully</p>
          )}
          <button
            type="submit"
            disabled={changePassword.isPending}
            className="px-4 py-2 rounded-lg bg-accent text-accent-text text-sm font-medium
              hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {changePassword.isPending ? "Changing¡­" : "Change password"}
          </button>
        </form>
      </section>

      {/* Danger zone */}
      <section className="mb-10">
        <h2 className="text-lg font-medium text-error mb-4">Danger Zone</h2>
        <div className="p-4 rounded-lg border border-error/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Delete account</p>
              <p className="text-xs text-text-tertiary mt-0.5">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <button
              onClick={handleDeleteAccount}
              disabled={deleteAccount.isPending}
              className="px-4 py-2 rounded-lg border border-error text-error text-sm font-medium
                hover:bg-error/10 transition-colors disabled:opacity-50"
            >
              {deleteAccount.isPending ? "Deleting¡­" : "Delete account"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
