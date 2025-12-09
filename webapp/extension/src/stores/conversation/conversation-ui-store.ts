import { create } from "zustand";
import { createRef } from "react";

export const COLLAPSED_HEIGHT = 460;

export const DISPLAY_MODES = [
  { key: "floating", label: "窗口化" },
  { key: "right-fixed", label: "右侧固定" },
  { key: "bottom-fixed", label: "底部固定" },
] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number]["key"];

const localStorageKey = {
  displayMode: "pd.layout.displayMode",
  floatingX: "pd.layout.floating.X",
  floatingY: "pd.layout.floating.Y",
  floatingWidth: "pd.layout.floating.W",
  floatingHeight: "pd.layout.floating.H",
  rightFixedWidth: "pd.layout.rightFixed.W",
  bottomFixedHeight: "pd.layout.bottomFixed.H",
  isOpen: "pd.layout.isOpen",
  activeTab: "pd.layout.activeTab",
  sidebarCollapsed: "pd.layout.sidebar.collapsed",
  heightCollapseRequired: "pd.layout.heightCollapseRequired",
} as const;

export const getLocalStorage = <T>(key: keyof typeof localStorageKey): T | undefined => {
  const value = localStorage.getItem(localStorageKey[key]);
  return value ? (JSON.parse(value) as T) : undefined;
};

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

  resetPosition: () => void;
}

// TODO: track the behavior
export const useConversationUiStore = create<ConversationUiStore>((set) => ({
  inputRef: createRef<HTMLTextAreaElement>(),

  prompt: "",
  setPrompt: (prompt: string) => set({ prompt }),

  showChatHistory: false,
  setShowChatHistory: (showChatHistory: boolean) => set({ showChatHistory: showChatHistory }),

  displayMode: getLocalStorage("displayMode") || "right-fixed",
  setDisplayMode: (displayMode: DisplayMode) => {
    localStorage.setItem(localStorageKey.displayMode, JSON.stringify(displayMode));
    set({ displayMode });
  },

  floatingX: getLocalStorage("floatingX") || 100,
  setFloatingX: (floatingX: number) => {
    localStorage.setItem(localStorageKey.floatingX, JSON.stringify(floatingX));
    set({ floatingX });
  },

  floatingY: getLocalStorage("floatingY") || 100,
  setFloatingY: (floatingY: number) => {
    localStorage.setItem(localStorageKey.floatingY, JSON.stringify(floatingY));
    set({ floatingY });
  },

  floatingWidth: getLocalStorage("floatingWidth") || 660,
  setFloatingWidth: (floatingWidth: number) => {
    localStorage.setItem(localStorageKey.floatingWidth, JSON.stringify(floatingWidth));
    set({ floatingWidth });
  },

  floatingHeight: getLocalStorage("floatingHeight") || 500,
  setFloatingHeight: (floatingHeight: number) => {
    localStorage.setItem(localStorageKey.floatingHeight, JSON.stringify(floatingHeight));
    set({ floatingHeight });
  },

  bottomFixedHeight: getLocalStorage("bottomFixedHeight") || 470,
  setBottomFixedHeight: (bottomFixedHeight: number) => {
    localStorage.setItem(localStorageKey.bottomFixedHeight, JSON.stringify(bottomFixedHeight));
    set({ bottomFixedHeight });
  },

  rightFixedWidth: getLocalStorage("rightFixedWidth") || 580,
  setRightFixedWidth: (rightFixedWidth: number) => {
    localStorage.setItem(localStorageKey.rightFixedWidth, JSON.stringify(rightFixedWidth));
    set({ rightFixedWidth });
  },

  isOpen: getLocalStorage("isOpen") || false,
  setIsOpen: (isOpen: boolean) => {
    localStorage.setItem(localStorageKey.isOpen, JSON.stringify(isOpen));
    set({ isOpen });
  },

  activeTab: getLocalStorage("activeTab") || "chat",
  setActiveTab: (activeTab: string) => {
    localStorage.setItem(localStorageKey.activeTab, JSON.stringify(activeTab));
    set({ activeTab });
  },

  sidebarCollapsed: getLocalStorage("sidebarCollapsed") || false,
  setSidebarCollapsed: (sidebarCollapsed: boolean) => {
    localStorage.setItem(localStorageKey.sidebarCollapsed, JSON.stringify(sidebarCollapsed));
    set({ sidebarCollapsed });
  },

  heightCollapseRequired: getLocalStorage("heightCollapseRequired") || false,
  setHeightCollapseRequired: (heightCollapseRequired: boolean) => {
    localStorage.setItem(localStorageKey.heightCollapseRequired, JSON.stringify(heightCollapseRequired));
    set({ heightCollapseRequired });
  },

  resetPosition: () => {
    set((state) => {
      state.setFloatingX(100);
      state.setFloatingY(100);
      state.setFloatingWidth(620);
      state.setFloatingHeight(200);
      state.setDisplayMode("floating");

      return {};
    });
  },
}));

// selectedText is controlled by  the "selection-store.ts"
