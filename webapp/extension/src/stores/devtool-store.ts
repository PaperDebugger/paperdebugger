import { create } from "zustand";

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
  showTool: JSON.parse(localStorage.getItem(localStorageKey.showTool) || "false"),
  setShowTool: (showTool: boolean) => {
    localStorage.setItem(localStorageKey.showTool, JSON.stringify(showTool));
    set({ showTool });
  },

  slowStreamingMode: JSON.parse(localStorage.getItem(localStorageKey.slowStreamingMode) || "false"),
  setSlowStreamingMode: (slowStreamingMode: boolean) => {
    localStorage.setItem(localStorageKey.slowStreamingMode, JSON.stringify(slowStreamingMode));
    set({ slowStreamingMode });
  },

  alwaysSyncProject: JSON.parse(localStorage.getItem(localStorageKey.alwaysSyncProject) || "false"),
  setAlwaysSyncProject: (alwaysSyncProject: boolean) => {
    localStorage.setItem(localStorageKey.alwaysSyncProject, JSON.stringify(alwaysSyncProject));
    set({ alwaysSyncProject });
  },
}));
