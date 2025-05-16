import { create } from "zustand";
import { createSelectors } from "./util";

// Interface for main content tabs
export type TabType = "chat" | "settings";

interface UIState {
  // Navigation and tabs
  activeTab: TabType;

  // Sidebar and panel visibility
  showFactsSidebar: boolean;
  activeSidebarMessageId: string | null;

  // Actions
  setActiveTab: (tab: TabType) => void;
  toggleFactsSidebar: () => void;
  showFactsForMessage: (messageId: string | null) => void;
}

const useUIStoreBase = create<UIState>((set) => ({
  // Initial state
  activeTab: "chat",
  showFactsSidebar: false,
  activeSidebarMessageId: null,

  // Actions
  setActiveTab: (tab: TabType) => set({ activeTab: tab }),

  toggleFactsSidebar: () =>
    set((state) => ({
      showFactsSidebar: !state.showFactsSidebar,
    })),

  showFactsForMessage: (messageId: string | null) =>
    set({
      activeSidebarMessageId: messageId,
      showFactsSidebar: messageId !== null,
    }),
}));
export const useUIStore = createSelectors(useUIStoreBase);
