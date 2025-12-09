import { useCallback, useEffect, useState } from "react";
import { MessageType, PermissionItem, PermissionMessage } from "./hostPermissionTypes";
import { requestHostPermission } from "../../../../intermediate";

const normalizeWildcardPattern = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false as const, error: "Please enter a URL" };
  }

  // Allow Chrome host permission wildcard protocol "*://"
  const starSchemeWildcardMatch = trimmed.match(/^\*:\/\/\*\.([^/\s]+)(?:\/\*)?\/?$/i);
  if (starSchemeWildcardMatch) {
    const host = starSchemeWildcardMatch[1];
    return { valid: true as const, origin: `*://*.${host}/*` };
  }

  const starSchemeHostMatch = trimmed.match(/^\*:\/\/([^/\s]+)(?:\/\*)?\/?$/i);
  if (starSchemeHostMatch) {
    const host = starSchemeHostMatch[1];
    return { valid: true as const, origin: `*://${host}/*` };
  }

  const wildcardMatch = trimmed.match(/^(https?):\/\/\*\.([^/\s]+)(?:\/\*)?\/?$/i);
  if (wildcardMatch) {
    const protocol = wildcardMatch[1].toLowerCase();
    const host = wildcardMatch[2];
    return { valid: true as const, origin: `${protocol}://*.${host}/*` };
  }

  try {
    const urlObj = new URL(trimmed);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return { valid: false as const, error: "URL must start with http://, https://, or *://" };
    }
    return { valid: true as const, origin: `${urlObj.origin}/*` };
  } catch (e) {
    return {
      valid: false as const,
      error:
        "Invalid URL. Use a full URL (e.g., https://www.example.com/) or a wildcard host (e.g., https://*.example.com/* or *://*.example.com/*)",
    };
  }
};

export const useHostPermissionManager = () => {
  const [permissionUrl, setPermissionUrl] = useState<string>("");
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<PermissionMessage | null>(null);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);

  const checkPermission = useCallback(async (origin: string): Promise<boolean> => {
    try {
      return await chrome.permissions.contains({ origins: [origin] });
    } catch (error) {
      console.error("Error checking permission:", error);
      return false;
    }
  }, []);

  const loadPermissions = useCallback(async () => {
    setIsLoadingPermissions(true);
    try {
      const chromePermissions = await chrome.permissions.getAll();
      const origins = chromePermissions.origins || [];

      if (origins.length === 0) {
        setPermissions([]);
        return;
      }

      const items: PermissionItem[] = origins.map((origin) => ({
        origin,
        granted: true,
      }));
      setPermissions(items);
    } catch (error) {
      console.error("Error loading permissions:", error);
      setMessage({ text: "Error loading permissions.", type: "error" });
    } finally {
      setIsLoadingPermissions(false);
    }
  }, []);

  const submitPermissionRequest = useCallback(async () => {
    if (!permissionUrl) {
      setMessage({ text: "Please enter a URL", type: "error" });
      setIsSubmitting(false);
      return;
    }

    setMessage(null);
    setIsSubmitting(true);

    const validation = normalizeWildcardPattern(permissionUrl);

    if (!validation.valid) {
      setMessage({ text: validation.error, type: "error" });
      setIsSubmitting(false);
      return;
    }

    const origin = validation.origin;

    try {
      const alreadyGranted = await checkPermission(origin);
      if (alreadyGranted) {
        setMessage({ text: `Permission for ${origin} is already granted.`, type: "info" });
        await loadPermissions();
        return;
      }

      const granted = await requestHostPermission(origin);

      if (granted) {
        setMessage({ text: `Permission granted for ${origin}`, type: "success" });
        await loadPermissions();
      } else {
        setMessage({ text: `Permission denied for ${origin}`, type: "error" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessage({ text: `Error: ${errorMessage}`, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }, [permissionUrl, checkPermission, loadPermissions]);

  const getMessageClassName = useCallback((type: MessageType): string => {
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
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  return {
    permissionUrl,
    setPermissionUrl,
    permissions,
    isSubmitting,
    message,
    isLoadingPermissions,
    submitPermissionRequest,
    getMessageClassName,
  };
};

