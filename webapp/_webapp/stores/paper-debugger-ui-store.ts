import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type DisplayMode = "floating" | "right-fixed" | "bottom-fixed";

interface PaperDebuggerUiStore {
  displayMode: DisplayMode;
  setDisplayMode: (displayMode: DisplayMode) => void;

  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;

  floatingX: number;
  setFloatingX: (floatingX: number) => void;
  floatingY: number;
  setFloatingY: (floatingY: number) => void;
  floatingWidth: number;
  setFloatingWidth: (floatingWidth: number) => void;
  floatingHeight: number;
  setFloatingHeight: (floatingHeight: number) => void;

  rightFixedWidth: number;
  setRightFixedWidth: (rightFixedWidth: number) => void;
  bottomFixedHeight: number;
  setBottomFixedHeight: (bottomFixedHeight: number) => void;

  resetPosition: () => void;
}

export const usePaperDebuggerUiStore = create<PaperDebuggerUiStore>()(
  persist(
    (set) => ({
      displayMode: "right-fixed",
      setDisplayMode: (displayMode) => set({ displayMode }),

      isOpen: false,
      setIsOpen: (isOpen) => set({ isOpen }),

      floatingX: 100,
      setFloatingX: (floatingX) => set({ floatingX }),
      floatingY: 100,
      setFloatingY: (floatingY) => set({ floatingY }),
      floatingWidth: 660,
      setFloatingWidth: (floatingWidth) => set({ floatingWidth }),
      floatingHeight: 500,
      setFloatingHeight: (floatingHeight) => set({ floatingHeight }),

      rightFixedWidth: 580,
      setRightFixedWidth: (rightFixedWidth) => set({ rightFixedWidth }),
      bottomFixedHeight: 470,
      setBottomFixedHeight: (bottomFixedHeight) => set({ bottomFixedHeight }),

      resetPosition: () => set({ floatingX: 100, floatingY: 100, floatingWidth: 500, floatingHeight: 500, displayMode: "floating" }),
    }),
    {
      name: "pd.layout-storage",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
