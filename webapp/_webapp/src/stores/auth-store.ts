import { create } from "zustand";
import { PlainMessage } from "../query/types";
import { User } from "../pkg/gen/apiclient/user/v1/user_pb";
import apiclient, { apiclientV2 } from "../libs/apiclient";
import { logout as apiLogout, getUser } from "../query/api";
import { logInfo } from "../libs/logger";
import { storage } from "../libs/storage";

const LOCAL_STORAGE_KEY = {
  TOKEN: "pd.auth.token",
  REFRESH_TOKEN: "pd.auth.refreshToken",
  USER: "pd.auth.user",
  OVERLEAF_SESSION: "pd.auth.overleafSession",
  GCLB: "pd.auth.gclb",
};

export interface AuthStore {
  isAuthenticated: () => boolean;

  user: PlainMessage<User> | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;

  token: string;
  setToken: (token: string) => void;

  refreshToken: string;
  setRefreshToken: (refreshToken: string) => void;

  /**
   * Initialize store from storage.
   * Must be called after storage adapter is set (e.g., after Office.onReady).
   * This reloads token/refreshToken from the configured storage adapter.
   */
  initFromStorage: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  isAuthenticated: () => {
    return get().user !== null;
  },

  user: null,

  login: async () => {
    const { token, refreshToken } = get();
    apiclient.setTokens(token, refreshToken);
    apiclientV2.setTokens(token, refreshToken);

    getUser()
      .then((resp) => {
        set({ user: resp?.user ?? null });
      })
      .catch(() => {
        set({ user: null });
      });
  },

  logout: async () => {
    const { refreshToken } = get();
    storage.removeItem(LOCAL_STORAGE_KEY.USER);
    storage.removeItem(LOCAL_STORAGE_KEY.TOKEN);
    storage.removeItem(LOCAL_STORAGE_KEY.REFRESH_TOKEN);
    try {
      await Promise.all([apiLogout({ refreshToken })]);
      logInfo("logged out");
    } catch {
      // ignored
    }
    apiclient.clearTokens();
    apiclientV2.clearTokens();
    set({ user: null, token: "", refreshToken: "" });
  },

  // Initial values are empty - will be populated by initFromStorage()
  // This ensures we don't read from storage before the adapter is set
  token: storage.getItem(LOCAL_STORAGE_KEY.TOKEN) ?? "",
  setToken: (token) => {
    storage.setItem(LOCAL_STORAGE_KEY.TOKEN, token);
    set({ token });
  },

  refreshToken: storage.getItem(LOCAL_STORAGE_KEY.REFRESH_TOKEN) ?? "",
  setRefreshToken: (refreshToken) => {
    storage.setItem(LOCAL_STORAGE_KEY.REFRESH_TOKEN, refreshToken ?? "");
    set({ refreshToken });
  },

  initFromStorage: () => {
    // Function intentionally left empty - initialization handled elsewhere
  },
}));
