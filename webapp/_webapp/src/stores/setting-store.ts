import { create } from "zustand";
import { getSettings, resetSettings, updateSettings } from "../query/api";
import { Settings, UpdateSettingsRequest } from "../pkg/gen/apiclient/user/v1/user_pb";
import { PlainMessage } from "../query/types";
import { logError } from "../libs/logger";

export interface SettingStore {
  settings: PlainMessage<Settings> | null;
  isLoading: boolean;
  isUpdating: Record<keyof Settings, boolean>;
  error: string | null;
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<PlainMessage<Settings>>) => Promise<void>;
  resetSettings: () => Promise<void>;

  enableUserDeveloperTools: boolean; // 不是真的 developer tool
  setEnableUserDeveloperTools: (enable: boolean) => void;

  conversationMode: "debug" | "normal";
  setConversationMode: (mode: "debug" | "normal") => void;

  disableLineWrap: boolean;
  setDisableLineWrap: (enable: boolean) => void;

  minimalistMode: boolean;
  setMinimalistMode: (enable: boolean) => void;

  hideAvatar: boolean;
  setHideAvatar: (enable: boolean) => void;
}

const defaultSettings: PlainMessage<Settings> = {
  showShortcutsAfterSelection: true,
  fullWidthPaperDebuggerButton: true,
  enableCompletion: false,
  fullDocumentRag: false,
  showedOnboarding: true,
};

export const useSettingStore = create<SettingStore>()((set, get) => ({
  settings: null,
  isLoading: true,
  isUpdating: {} as Record<keyof Settings, boolean>,
  error: null,

  loadSettings: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await getSettings();

      set({
        settings: response.settings,
        isLoading: false,
      });

      const isUpdating = get().isUpdating;
      for (const key in response.settings) {
        isUpdating[key as keyof Settings] = false;
      }
      set({ isUpdating: { ...isUpdating } });
    } catch (error) {
      // Fallback to default settings if loading fails
      set({
        settings: defaultSettings,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load settings",
      });
    }
  },

  updateSettings: async (partialSettings) => {
    try {
      set({ error: null });
      const store = get();
      const currentSettings = store.settings || defaultSettings;
      const mergedSettings: PlainMessage<UpdateSettingsRequest> = {
        settings: {
          ...currentSettings,
          ...partialSettings,
        },
      };
      for (const key in partialSettings) {
        set({ isUpdating: { ...store.isUpdating, [key]: true } });
      }

      const response = await updateSettings(mergedSettings);
      set({ settings: response.settings || null });
      for (const key in partialSettings) {
        set({ isUpdating: { ...store.isUpdating, [key]: false } });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to update settings",
      });
      logError("Failed to update settings", error);
    }
  },

  resetSettings: async () => {
    try {
      // iterate over all settings and set isUpdating to true
      const isUpdating = get().isUpdating;
      for (const key in isUpdating) {
        isUpdating[key as keyof Settings] = true;
      }
      set({ isUpdating: { ...isUpdating } });

      const response = await resetSettings();
      set({ settings: response.settings || null });

      // iterate over all settings and set isUpdating to false
      for (const key in isUpdating) {
        isUpdating[key as keyof Settings] = false;
      }
      set({ isUpdating: { ...isUpdating } });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to reset settings",
      });
    }
  },

  enableUserDeveloperTools: localStorage.getItem("pd.devtool.enabled") === "true" || false,
  setEnableUserDeveloperTools: (enable: boolean) => {
    localStorage.setItem("pd.devtool.enabled", enable.toString());
    set({ enableUserDeveloperTools: enable });
  },

  conversationMode: (localStorage.getItem("pd.devtool.conversationMode") as "debug" | "normal") || "normal",
  setConversationMode: (mode: "debug" | "normal") => {
    localStorage.setItem("pd.devtool.conversationMode", mode);
    set({ conversationMode: mode });
  },

  disableLineWrap: localStorage.getItem("pd.lineWrap.enabled") === "true" || false,
  setDisableLineWrap: (enable: boolean) => {
    localStorage.setItem("pd.lineWrap.enabled", enable.toString());
    set({ disableLineWrap: enable });
  },

  minimalistMode: localStorage.getItem("pd.ui.minimalistMode") === "true" || false,
  setMinimalistMode: (enable: boolean) => {
    localStorage.setItem("pd.ui.minimalistMode", enable.toString());
    set({ minimalistMode: enable });
  },

  hideAvatar: localStorage.getItem("pd.ui.hideAvatar") === "true" || false,
  setHideAvatar: (enable: boolean) => {
    localStorage.setItem("pd.ui.hideAvatar", enable.toString());
    set({ hideAvatar: enable });
  },
}));
