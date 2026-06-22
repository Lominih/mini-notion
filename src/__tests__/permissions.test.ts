import { describe, it, expect } from "vitest";
import {
  roleAtLeast,
  canEdit,
  canDelete,
  canInvite,
  canShare,
  canManageWorkspace,
  isOwner,
} from "@/server/services/permissions";
import type { MemberRole } from "@prisma/client";

/**
 * Unit tests for the permissions service.
 * Tests role hierarchy and permission checks.
 */

describe("permissions service", () => {
  describe("roleAtLeast", () => {
    it("OWNER is at least OWNER", () => {
      expect(roleAtLeast("OWNER", "OWNER")).toBe(true);
    });

    it("ADMIN is at least ADMIN", () => {
      expect(roleAtLeast("ADMIN", "ADMIN")).toBe(true);
    });

    it("MEMBER is at least MEMBER", () => {
      expect(roleAtLeast("MEMBER", "MEMBER")).toBe(true);
    });

    it("VIEWER is at least VIEWER", () => {
      expect(roleAtLeast("VIEWER", "VIEWER")).toBe(true);
    });

    it("OWNER is at least ADMIN", () => {
      expect(roleAtLeast("OWNER", "ADMIN")).toBe(true);
    });

    it("ADMIN is at least MEMBER", () => {
      expect(roleAtLeast("ADMIN", "MEMBER")).toBe(true);
    });

    it("MEMBER is at least VIEWER", () => {
      expect(roleAtLeast("MEMBER", "VIEWER")).toBe(true);
    });

    it("VIEWER is NOT at least MEMBER", () => {
      expect(roleAtLeast("VIEWER", "MEMBER")).toBe(false);
    });

    it("MEMBER is NOT at least ADMIN", () => {
      expect(roleAtLeast("MEMBER", "ADMIN")).toBe(false);
    });

    it("ADMIN is NOT at least OWNER", () => {
      expect(roleAtLeast("ADMIN", "OWNER")).toBe(false);
    });
  });

  describe("canEdit", () => {
    it("OWNER can edit", () => expect(canEdit("OWNER")).toBe(true));
    it("ADMIN can edit", () => expect(canEdit("ADMIN")).toBe(true));
    it("MEMBER can edit", () => expect(canEdit("MEMBER")).toBe(true));
    it("VIEWER cannot edit", () => expect(canEdit("VIEWER")).toBe(false));
  });

  describe("canDelete", () => {
    it("OWNER can delete", () => expect(canDelete("OWNER")).toBe(true));
    it("ADMIN can delete", () => expect(canDelete("ADMIN")).toBe(true));
    it("MEMBER cannot delete", () => expect(canDelete("MEMBER")).toBe(false));
    it("VIEWER cannot delete", () => expect(canDelete("VIEWER")).toBe(false));
  });

  describe("canInvite", () => {
    it("OWNER can invite", () => expect(canInvite("OWNER")).toBe(true));
    it("ADMIN can invite", () => expect(canInvite("ADMIN")).toBe(true));
    it("MEMBER can invite", () => expect(canInvite("MEMBER")).toBe(true));
    it("VIEWER cannot invite", () => expect(canInvite("VIEWER")).toBe(false));
  });

  describe("canShare", () => {
    it("OWNER can share", () => expect(canShare("OWNER")).toBe(true));
    it("MEMBER can share", () => expect(canShare("MEMBER")).toBe(true));
    it("VIEWER cannot share", () => expect(canShare("VIEWER")).toBe(false));
  });

  describe("canManageWorkspace", () => {
    it("OWNER can manage", () => expect(canManageWorkspace("OWNER")).toBe(true));
    it("ADMIN can manage", () => expect(canManageWorkspace("ADMIN")).toBe(true));
    it("MEMBER cannot manage", () => expect(canManageWorkspace("MEMBER")).toBe(false));
    it("VIEWER cannot manage", () => expect(canManageWorkspace("VIEWER")).toBe(false));
  });

  describe("isOwner", () => {
    it("OWNER is owner", () => expect(isOwner("OWNER")).toBe(true));
    it("ADMIN is not owner", () => expect(isOwner("ADMIN")).toBe(false));
    it("MEMBER is not owner", () => expect(isOwner("MEMBER")).toBe(false));
    it("VIEWER is not owner", () => expect(isOwner("VIEWER")).toBe(false));
  });

  describe("comprehensive role hierarchy", () => {
    const roles: MemberRole[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

    it("should have consistent ordering", () => {
      for (let i = 0; i < roles.length; i++) {
        for (let j = 0; j < roles.length; j++) {
          const result = roleAtLeast(roles[i], roles[j]);
          if (i <= j) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        }
      }
    });
  });
});

