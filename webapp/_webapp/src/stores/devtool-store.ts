import { create } from "zustand";

/**
 * Devtool settings use localStorage directly (not the storage adapter).
 * These settings are local to each device and don't need cross-device sync.
 */
const STORAGE_KEY = {
  showTool: "pd.devtool.showTool",
  slowStreamingMode: "pd.devtool.slowStreamingMode",
  alwaysSyncProject: "pd.devtool.alwaysSyncProject",
} as const;

function getLocalStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setLocalStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors
  }
}

interface DevtoolStore {
  showTool: boolean;
  setShowTool: (showTool: boolean) => void;

  slowStreamingMode: boolean;
  setSlowStreamingMode: (slowStreamingMode: boolean) => void;

  alwaysSyncProject: boolean;
  setAlwaysSyncProject: (alwaysSyncProject: boolean) => void;
}

export const useDevtoolStore = create<DevtoolStore>((set) => ({
  showTool: getLocalStorageItem(STORAGE_KEY.showTool) === "true",
  setShowTool: (showTool: boolean) => {
    setLocalStorageItem(STORAGE_KEY.showTool, JSON.stringify(showTool));
    set({ showTool });
  },

  slowStreamingMode: getLocalStorageItem(STORAGE_KEY.slowStreamingMode) === "true",
  setSlowStreamingMode: (slowStreamingMode: boolean) => {
    setLocalStorageItem(STORAGE_KEY.slowStreamingMode, JSON.stringify(slowStreamingMode));
    set({ slowStreamingMode });
  },

  alwaysSyncProject: getLocalStorageItem(STORAGE_KEY.alwaysSyncProject) === "true",
  setAlwaysSyncProject: (alwaysSyncProject: boolean) => {
    setLocalStorageItem(STORAGE_KEY.alwaysSyncProject, JSON.stringify(alwaysSyncProject));
    set({ alwaysSyncProject });
  },
}));
