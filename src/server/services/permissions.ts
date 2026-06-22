import { MemberRole } from "@prisma/client";

const ROLE_HIERARCHY: Record<MemberRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

export function roleAtLeast(role: MemberRole, required: MemberRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[required];
}

export function canEdit(role: MemberRole): boolean {
  return roleAtLeast(role, "MEMBER");
}

export function canDelete(role: MemberRole): boolean {
  return roleAtLeast(role, "ADMIN");
}

export function canInvite(role: MemberRole): boolean {
  return roleAtLeast(role, "MEMBER");
}

export function canShare(role: MemberRole): boolean {
  return roleAtLeast(role, "MEMBER");
}

export function canManageWorkspace(role: MemberRole): boolean {
  return roleAtLeast(role, "ADMIN");
}

export function isOwner(role: MemberRole): boolean {
  return role === "OWNER";
}

