import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type DisplayMode = "floating" | "right-fixed" | "bottom-fixed";
export type TabOrientation = "vertical" | "horizontal";

interface PaperDebuggerUiState {
  displayMode: DisplayMode;
  tabOrientation: TabOrientation;
  isOpen: boolean;

  floatingX: number;
  floatingY: number;
  floatingWidth: number;
  floatingHeight: number;

  rightFixedWidth: number;
  bottomFixedHeight: number;
}

interface PaperDebuggerUiStore extends PaperDebuggerUiState {
  update: (patch: Partial<PaperDebuggerUiState>) => void;
  resetPosition: () => void;
}

export const usePaperDebuggerUiStore = create<PaperDebuggerUiStore>()(
  persist(
    (set) => ({
      displayMode: "right-fixed",
      tabOrientation: "vertical",
      isOpen: false,

      floatingX: 100,
      floatingY: 100,
      floatingWidth: 660,
      floatingHeight: 500,

      rightFixedWidth: 580,
      bottomFixedHeight: 470,

      update: (patch) => set(patch),
      resetPosition: () =>
        set({ displayMode: "floating", floatingX: 100, floatingY: 100, floatingWidth: 500, floatingHeight: 500 }),
    }),
    {
      name: "pd.layout-storage",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
