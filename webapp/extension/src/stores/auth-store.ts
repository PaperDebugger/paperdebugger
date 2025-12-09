import { create } from "zustand";
import { PlainMessage } from "../query/types";
import { User } from "../pkg/gen/apiclient/user/v1/user_pb";
import apiclient from "../libs/apiclient";
import { logout as apiLogout, getUser } from "../query/api";
import { logInfo } from "../libs/logger";

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
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  isAuthenticated: () => {
    return get().user !== null;
  },

  user: null,

  login: async () => {
    const { token, refreshToken } = get();
    apiclient.setTokens(token, refreshToken);

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
    localStorage.removeItem(LOCAL_STORAGE_KEY.USER);
    localStorage.removeItem(LOCAL_STORAGE_KEY.TOKEN);
    localStorage.removeItem(LOCAL_STORAGE_KEY.REFRESH_TOKEN);
    try {
      await Promise.all([apiLogout({ refreshToken })]);
      logInfo("logged out");
    } catch {
      // ignored
    }
    apiclient.clearTokens();
    set({ user: null, token: "", refreshToken: "" });
  },

  token: localStorage.getItem(LOCAL_STORAGE_KEY.TOKEN) ?? "",
  setToken: (token) => {
    localStorage.setItem(LOCAL_STORAGE_KEY.TOKEN, token);
    set({ token });
  },

  refreshToken: localStorage.getItem(LOCAL_STORAGE_KEY.REFRESH_TOKEN) ?? "",
  setRefreshToken: (refreshToken) => {
    localStorage.setItem(LOCAL_STORAGE_KEY.REFRESH_TOKEN, refreshToken ?? "");
    set({ refreshToken });
  },
}));
