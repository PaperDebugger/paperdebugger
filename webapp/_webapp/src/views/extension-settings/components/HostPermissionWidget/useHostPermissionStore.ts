import { create } from "zustand";
import { requestHostPermission } from "../../../../intermediate";
import { PermissionItem, PermissionMessage } from "./hostPermissionTypes";

const normalizeWildcardPattern = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false as const, error: "Please enter a URL" };
  }

  // Chrome host permission pattern: <scheme>://<host><path>
  // scheme: *, http, https
  // host: can include wildcard like *.example.com or specific domain
  // path: must include at least /, typically /*
  const hostPermissionPattern = /^(\*|https?):\/\/((?:\*\.)?[^/\s]+)(\/.*)?$/i;
  const match = trimmed.match(hostPermissionPattern);

  if (match) {
    const scheme = match[1].toLowerCase();
    const host = match[2];
    const path = match[3] || "/*";
    
    // Normalize scheme (keep * as is, normalize http/https)
    const normalizedScheme = scheme === "*" ? "*" : scheme;
    // Ensure path ends with /* if it's just /
    const normalizedPath = path === "/" ? "/*" : path.endsWith("/*") ? path : `${path}/*`;
    
    return { valid: true as const, origin: `${normalizedScheme}://${host}${normalizedPath}` };
  }

  // Try parsing as regular URL if pattern doesn't match
  try {
    const urlObj = new URL(trimmed);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return { valid: false as const, error: "URL must start with http://, https://, or *://" };
    }
    return { valid: true as const, origin: `${urlObj.protocol}//${urlObj.host}/*` };
  } catch (e) {
    return {
      valid: false as const,
      error:
        "Invalid URL. Use a full URL (e.g., https://example.com) or a wildcard pattern (e.g., https://*.example.com/*, *://*.example.com/*)",
    };
  }
};

interface HostPermissionState {
  permissionUrl: string;
  permissions: PermissionItem[];
  isSubmitting: boolean;
  isLoadingPermissions: boolean;
  message: PermissionMessage | null;
  setPermissionUrl: (value: string) => void;
  clearMessage: () => void;
  loadPermissions: () => Promise<void>;
  submitPermissionRequest: () => Promise<void>;
}

const handleError = (error: unknown, defaultMessage: string): string => {
  console.error(defaultMessage, error);
  return error instanceof Error ? error.message : defaultMessage;
};

export const useHostPermissionStore = create<HostPermissionState>((set, get) => ({
  permissionUrl: "",
  permissions: [],
  isSubmitting: false,
  isLoadingPermissions: true,
  message: null,
  setPermissionUrl: (value) => set({ permissionUrl: value }),
  clearMessage: () => set({ message: null }),
  loadPermissions: async () => {
    set({ isLoadingPermissions: true });
    
    const chromePermissions = await chrome.permissions.getAll().catch((error) => {
      const errorMessage = handleError(error, "Error loading permissions.");
      set({ message: { text: errorMessage, type: "error" } });
      return null;
    });

    const origins = chromePermissions?.origins || [];
    const permissions: PermissionItem[] = origins.map((origin) => ({ origin, granted: true }));
    
    set({ permissions, isLoadingPermissions: false });
  },
  submitPermissionRequest: async () => {
    const { permissionUrl } = get();

    if (!permissionUrl) {
      set({ message: { text: "Please enter a URL", type: "error" } });
      return;
    }

    const validation = normalizeWildcardPattern(permissionUrl);
    if (!validation.valid) {
      set({ message: { text: validation.error, type: "error" } });
      return;
    }

    set({ message: null, isSubmitting: true });
    const origin = validation.origin;

    const alreadyGranted = await chrome.permissions.contains({ origins: [origin] }).catch(() => false);
    if (alreadyGranted) {
      set({ message: { text: `Permission for ${origin} is already granted.`, type: "info" }, isSubmitting: false });
      await get().loadPermissions();
      return;
    }

    const granted = await requestHostPermission(origin).catch((error) => {
      const errorMessage = handleError(error, "Error requesting permission");
      set({ message: { text: `Error: ${errorMessage}`, type: "error" }, isSubmitting: false });
      return false;
    });

    if (granted) {
      set({ message: { text: `Permission granted for ${origin}`, type: "success" } });
      await get().loadPermissions();
    } else {
      set({ message: { text: `Permission denied for ${origin}`, type: "error" } });
    }
    
    set({ isSubmitting: false });
  },
}));

export const getMessageClassName = (type: PermissionMessage["type"]): string => {
  switch (type) {
    case "success":
      return "bg-green-100 text-green-800 border border-green-300";
    case "error":
      return "bg-red-100 text-red-800 border border-red-300";
    case "info":
      return "bg-blue-100 text-blue-800 border border-blue-300";
    default:
      return "";
  }
};

