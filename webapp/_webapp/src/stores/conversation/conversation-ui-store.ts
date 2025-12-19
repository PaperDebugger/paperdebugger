import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createRef } from "react";

export const COLLAPSED_HEIGHT = 460;

export const DISPLAY_MODES = [
  { key: "floating", label: "Floating" },
  { key: "right-fixed", label: "Right Fixed" },
  { key: "bottom-fixed", label: "Bottom Fixed" },
] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number]["key"];

interface ConversationUiStore {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;

  prompt: string;
  setPrompt: (prompt: string) => void;

  showChatHistory: boolean;
  setShowChatHistory: (showChatHistory: boolean) => void;

  displayMode: DisplayMode;
  setDisplayMode: (displayMode: DisplayMode) => void;

  floatingX: number;
  setFloatingX: (floatingX: number) => void;

  floatingY: number;
  setFloatingY: (floatingY: number) => void;

  floatingWidth: number;
  setFloatingWidth: (floatingWidth: number) => void;

  floatingHeight: number;
  setFloatingHeight: (floatingHeight: number) => void;

  bottomFixedHeight: number;
  setBottomFixedHeight: (bottomFixedHeight: number) => void;

  rightFixedWidth: number;
  setRightFixedWidth: (rightFixedWidth: number) => void;

  isOpen: boolean; // for the main drawer
  setIsOpen: (isOpen: boolean) => void;

  activeTab: string;
  setActiveTab: (activeTab: string) => void;

  sidebarCollapsed: boolean;
  setSidebarCollapsed: (sidebarCollapsed: boolean) => void;

  heightCollapseRequired: boolean;
  setHeightCollapseRequired: (heightCollapseRequired: boolean) => void;

  lastUsedModelSlug: string;
  setLastUsedModelSlug: (lastUsedModelSlug: string) => void;

  resetPosition: () => void;
}

export const useConversationUiStore = create<ConversationUiStore>()(
  persist(
    (set) => ({
      inputRef: createRef<HTMLTextAreaElement>(),

      prompt: "",
      setPrompt: (prompt: string) => set({ prompt }),

      showChatHistory: false,
      setShowChatHistory: (showChatHistory: boolean) => set({ showChatHistory }),

      displayMode: "right-fixed",
      setDisplayMode: (displayMode: DisplayMode) => set({ displayMode }),

      floatingX: 100,
      setFloatingX: (floatingX: number) => set({ floatingX }),

      floatingY: 100,
      setFloatingY: (floatingY: number) => set({ floatingY }),

      floatingWidth: 660,
      setFloatingWidth: (floatingWidth: number) => set({ floatingWidth }),

      floatingHeight: 500,
      setFloatingHeight: (floatingHeight: number) => set({ floatingHeight }),

      bottomFixedHeight: 470,
      setBottomFixedHeight: (bottomFixedHeight: number) => set({ bottomFixedHeight }),

      rightFixedWidth: 580,
      setRightFixedWidth: (rightFixedWidth: number) => set({ rightFixedWidth }),

      isOpen: false,
      setIsOpen: (isOpen: boolean) => set({ isOpen }),

      activeTab: "chat",
      setActiveTab: (activeTab: string) => set({ activeTab }),

      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed: boolean) => set({ sidebarCollapsed }),

      heightCollapseRequired: false,
      setHeightCollapseRequired: (heightCollapseRequired: boolean) => set({ heightCollapseRequired }),

      lastUsedModelSlug: "gpt-4.1",
      setLastUsedModelSlug: (lastUsedModelSlug: string) => set({ lastUsedModelSlug }),

      resetPosition: () => {
        set({
          floatingX: 100,
          floatingY: 100,
          floatingWidth: 620,
          floatingHeight: 200,
          displayMode: "floating",
        });
      },
    }),
    {
      name: "pd.layout-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { inputRef, prompt, ...rest } = state;
        return rest;
      },
      // Map old keys to new storage if needed, or just migration
      version: 1,
    },
  ),
);

// selectedText is controlled by  the "selection-store.ts"
