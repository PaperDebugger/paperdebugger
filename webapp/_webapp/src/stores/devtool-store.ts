import { create } from "zustand";
import { storage } from "../libs/storage";

export const localStorageKey = {
  showTool: "pd.devtool.showTool",
  slowStreamingMode: "pd.devtool.slowStreamingMode",
  alwaysSyncProject: "pd.devtool.alwaysSyncProject",
} as const;

interface DevtoolStore {
  showTool: boolean;
  setShowTool: (showTool: boolean) => void;

  slowStreamingMode: boolean;
  setSlowStreamingMode: (slowStreamingMode: boolean) => void;

  alwaysSyncProject: boolean;
  setAlwaysSyncProject: (alwaysSyncProject: boolean) => void;
}

export const useDevtoolStore = create<DevtoolStore>((set) => ({
  showTool: storage.getItem(localStorageKey.showTool) === "true",
  setShowTool: (showTool: boolean) => {
    storage.setItem(localStorageKey.showTool, JSON.stringify(showTool));
    set({ showTool });
  },

  slowStreamingMode: storage.getItem(localStorageKey.slowStreamingMode) === "true",
  setSlowStreamingMode: (slowStreamingMode: boolean) => {
    storage.setItem(localStorageKey.slowStreamingMode, JSON.stringify(slowStreamingMode));
    set({ slowStreamingMode });
  },

  alwaysSyncProject: storage.getItem(localStorageKey.alwaysSyncProject) === "true",
  setAlwaysSyncProject: (alwaysSyncProject: boolean) => {
    storage.setItem(localStorageKey.alwaysSyncProject, JSON.stringify(alwaysSyncProject));
    set({ alwaysSyncProject });
  },
}));
