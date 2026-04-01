/**
 * Sidebar Store — manages sidebar collapsed/expanded state.
 * On mobile (< 1024px), sidebar starts collapsed.
 * On desktop, sidebar starts expanded.
 * User can toggle at any time.
 */

import { create } from "zustand";

interface SidebarState {
  isCollapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed: false,
  toggle: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
}));
