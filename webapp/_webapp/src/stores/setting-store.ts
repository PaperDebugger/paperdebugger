import { create } from "zustand";
import { getSettings, resetSettings, updateSettings } from "../query/api";
import { Settings, UpdateSettingsRequest } from "@gen/apiclient/user/v1/user_pb";
import { PlainMessage } from "../query/types";
import { logError } from "../libs/logger";
import { storage } from "../libs/storage";

// Storage keys for local UI settings
const LOCAL_STORAGE_KEY = {
  ENABLE_USER_DEVELOPER_TOOLS: "pd.devtool.enabled",
  CONVERSATION_MODE: "pd.devtool.conversationMode",
  DISABLE_LINE_WRAP: "pd.lineWrap.enabled",
  MINIMALIST_MODE: "pd.ui.minimalistMode",
  HIDE_AVATAR: "pd.ui.hideAvatar",
  ALLOW_OUT_OF_BOUNDS: "pd.ui.allowOutOfBounds",
  THEME_MODE: "pd.ui.themeMode",
};

export type ThemeMode = "auto" | "light" | "dark";

export interface SettingStore {
  settings: PlainMessage<Settings> | null;
  isLoading: boolean;
  isUpdating: Record<keyof Settings, boolean>;
  error: string | null;
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<PlainMessage<Settings>>) => Promise<void>;
  resetSettings: () => Promise<void>;

  /**
   * Initialize local UI settings from storage.
   * Must be called after storage adapter is set (e.g., after Office.onReady).
   * This reloads local UI settings from the configured storage adapter.
   */
  initLocalSettings: () => void;

  enableUserDeveloperTools: boolean; // Not actual developer tools
  setEnableUserDeveloperTools: (enable: boolean) => void;

  conversationMode: "debug" | "normal";
  setConversationMode: (mode: "debug" | "normal") => void;

  disableLineWrap: boolean;
  setDisableLineWrap: (enable: boolean) => void;

  minimalistMode: boolean;
  setMinimalistMode: (enable: boolean) => void;

  hideAvatar: boolean;
  setHideAvatar: (enable: boolean) => void;

  allowOutOfBounds: boolean;
  setAllowOutOfBounds: (enable: boolean) => void;

  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const defaultSettings: PlainMessage<Settings> = {
  showShortcutsAfterSelection: true,
  fullWidthPaperDebuggerButton: true,
  enableCitationSuggestion: false,
  fullDocumentRag: false,
  showedOnboarding: true,
  openaiApiKey: "",
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

  initLocalSettings: () => {
    const enableUserDeveloperTools = storage.getItem(LOCAL_STORAGE_KEY.ENABLE_USER_DEVELOPER_TOOLS) === "true";
    const conversationMode = (storage.getItem(LOCAL_STORAGE_KEY.CONVERSATION_MODE) as "debug" | "normal") || "normal";
    const disableLineWrap = storage.getItem(LOCAL_STORAGE_KEY.DISABLE_LINE_WRAP) === "true";
    const minimalistMode = storage.getItem(LOCAL_STORAGE_KEY.MINIMALIST_MODE) === "true";
    const hideAvatar = storage.getItem(LOCAL_STORAGE_KEY.HIDE_AVATAR) === "true";
    const allowOutOfBounds = storage.getItem(LOCAL_STORAGE_KEY.ALLOW_OUT_OF_BOUNDS) === "true";
    const themeMode = (storage.getItem(LOCAL_STORAGE_KEY.THEME_MODE) as ThemeMode) || "auto";

    set({
      enableUserDeveloperTools,
      conversationMode,
      disableLineWrap,
      minimalistMode,
      hideAvatar,
      allowOutOfBounds,
      themeMode,
    });
  },

  // Initial values are defaults - will be populated by initLocalSettings()
  // This ensures we don't read from storage before the adapter is set
  enableUserDeveloperTools: false,
  setEnableUserDeveloperTools: (enable: boolean) => {
    storage.setItem(LOCAL_STORAGE_KEY.ENABLE_USER_DEVELOPER_TOOLS, enable.toString());
    set({ enableUserDeveloperTools: enable });
  },

  conversationMode: "normal",
  setConversationMode: (mode: "debug" | "normal") => {
    storage.setItem(LOCAL_STORAGE_KEY.CONVERSATION_MODE, mode);
    set({ conversationMode: mode });
  },

  disableLineWrap: false,
  setDisableLineWrap: (enable: boolean) => {
    storage.setItem(LOCAL_STORAGE_KEY.DISABLE_LINE_WRAP, enable.toString());
    set({ disableLineWrap: enable });
  },

  minimalistMode: false,
  setMinimalistMode: (enable: boolean) => {
    storage.setItem(LOCAL_STORAGE_KEY.MINIMALIST_MODE, enable.toString());
    set({ minimalistMode: enable });
  },

  hideAvatar: false,
  setHideAvatar: (enable: boolean) => {
    storage.setItem(LOCAL_STORAGE_KEY.HIDE_AVATAR, enable.toString());
    set({ hideAvatar: enable });
  },

  allowOutOfBounds: false,
  setAllowOutOfBounds: (enable: boolean) => {
    storage.setItem(LOCAL_STORAGE_KEY.ALLOW_OUT_OF_BOUNDS, enable.toString());
    set({ allowOutOfBounds: enable });
  },

  themeMode: "auto",
  setThemeMode: (mode: ThemeMode) => {
    storage.setItem(LOCAL_STORAGE_KEY.THEME_MODE, mode);
    set({ themeMode: mode });
  },
}));
