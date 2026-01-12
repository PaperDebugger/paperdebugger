import { create } from "zustand";
import { storage } from "../libs/storage";

export const localStorageKey = {
  showTool: "pd.devtool.showTool",
  slowStreamingMode: "pd.devtool.slowStreamingMode",
  alwaysSyncProject: "pd.devtool.alwaysSyncProject",
} as const;

interface DevtoolStore {
  /**
   * Initialize devtool settings from storage.
   * Must be called after storage adapter is set (e.g., after Office.onReady).
   */
  initFromStorage: () => void;

  showTool: boolean;
  setShowTool: (showTool: boolean) => void;

  slowStreamingMode: boolean;
  setSlowStreamingMode: (slowStreamingMode: boolean) => void;

  alwaysSyncProject: boolean;
  setAlwaysSyncProject: (alwaysSyncProject: boolean) => void;
}

export const useDevtoolStore = create<DevtoolStore>((set) => ({
  initFromStorage: () => {
    const showTool = JSON.parse(storage.getItem(localStorageKey.showTool) || "false");
    const slowStreamingMode = JSON.parse(storage.getItem(localStorageKey.slowStreamingMode) || "false");
    const alwaysSyncProject = JSON.parse(storage.getItem(localStorageKey.alwaysSyncProject) || "false");
    set({ showTool, slowStreamingMode, alwaysSyncProject });
  },

  // Initial values are defaults - will be populated by initFromStorage()
  showTool: false,
  setShowTool: (showTool: boolean) => {
    storage.setItem(localStorageKey.showTool, JSON.stringify(showTool));
    set({ showTool });
  },

  slowStreamingMode: false,
  setSlowStreamingMode: (slowStreamingMode: boolean) => {
    storage.setItem(localStorageKey.slowStreamingMode, JSON.stringify(slowStreamingMode));
    set({ slowStreamingMode });
  },

  alwaysSyncProject: false,
  setAlwaysSyncProject: (alwaysSyncProject: boolean) => {
    storage.setItem(localStorageKey.alwaysSyncProject, JSON.stringify(alwaysSyncProject));
    set({ alwaysSyncProject });
  },
}));
