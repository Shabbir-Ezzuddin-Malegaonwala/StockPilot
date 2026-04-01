/**
 * Auth Store — HAND-WRITTEN (manages user role and organization context)
 *
 * Stores the current user's role, organization info, and session data.
 * Used for role-conditional UI rendering across all pages.
 * Fetched once on dashboard layout mount, then available globally.
 */

import { create } from "zustand";
import * as api from "@/lib/api";

interface AuthState {
  // User info
  user: { id: string; name: string; email: string; image: string | null } | null;

  // Role in current organization
  role: string | null; // "owner" | "admin" | "manager" | "member"

  // Organization info
  organization: { name: string; slug: string } | null;

  // Loading state
  isLoading: boolean;

  // Actions
  fetchRoleAndOrg: () => Promise<void>;
  setUser: (user: AuthState["user"]) => void;
  clear: () => void;

  // Role check helpers
  hasRole: (requiredRole: string) => boolean;
  isAdmin: () => boolean;
  isManager: () => boolean;
}

const roleHierarchy: Record<string, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  member: 1,
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: null,
  organization: null,
  isLoading: false,

  fetchRoleAndOrg: async () => {
    set({ isLoading: true });
    try {
      const roleInfo = await api.getMyRole();
      set({
        role: roleInfo.role,
        organization: {
          name: roleInfo.organizationName,
          slug: roleInfo.organizationSlug,
        },
        isLoading: false,
      });
    } catch {
      set({ role: null, organization: null, isLoading: false });
    }
  },

  setUser: (user) => set({ user }),

  clear: () => set({ user: null, role: null, organization: null }),

  hasRole: (requiredRole: string) => {
    const currentRole = get().role;
    if (!currentRole) return false;
    return (roleHierarchy[currentRole] || 0) >= (roleHierarchy[requiredRole] || 0);
  },

  isAdmin: () => get().hasRole("admin"),
  isManager: () => get().hasRole("manager"),
}));
