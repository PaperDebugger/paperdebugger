/*
 * intermediate.ts
 *
 * This file receives messages from the content_script.js and communicates with the
 * background script to get the cookie.
 *
 *
 * +-----------------+   chrome   +-------------------+    window   +---------------------+
 * |  background.js  | <--------> |  intermediate.js  | <---------> |  content_script.js  |
 * +-----------------+            +-------------------+             +---------------------+
 * - fetch cookies                - message broker                  - UI
 * - get google auth token        - ISOLATED world                  - MAIN world
 *                                - Listener: chrome.runtime        - Listener: window
 */
import { HANDLER_NAMES } from "./shared/constants";
import { v4 as uuidv4 } from "uuid";
import { storage } from "./libs/storage";

const REQUEST_TIMEOUT_MS = 5000;

export type MakeFunctionOpts = {
  wait?: boolean;
};

/**
 * Get the browser extension API (chrome or browser).
 * Returns undefined if not running in an extension context.
 */
function getBrowserAPI(): typeof chrome | undefined {
  try {
    // @ts-expect-error: browser may not be defined in all environments
    if (typeof browser !== "undefined" && browser?.runtime?.id) {
      // @ts-expect-error: browser may not be defined in all environments
      return browser;
    }
    if (typeof chrome !== "undefined" && chrome?.runtime?.id) {
      return chrome;
    }
  } catch {
    // Not in extension context
  }
  return undefined;
}

function makeFunction<A, T>(handlerName: string, opts?: MakeFunctionOpts): (args: A) => Promise<T> {
  const reqEvtName = `paperdebugger:req:${handlerName}`;
  const resEvtName = `paperdebugger:res:${handlerName}`;
  const errEvtName = `paperdebugger:err:${handlerName}`;

  const eventHandler = (evt: Event) => {
    const browserAPI = getBrowserAPI();
    const customEvt = evt as CustomEvent;
    const { seq, req } = customEvt.detail;
    if (!seq) return;
    if (!browserAPI?.runtime?.id) return;
    browserAPI?.runtime
      .sendMessage({
        action: handlerName,
        args: req,
      })
      .then((res: { error?: string }) => {
        if (res.error) {
          window.dispatchEvent(
            new CustomEvent(`${errEvtName}/${seq}`, {
              detail: { seq, err: res.error },
            }),
          );
        } else {
          window.dispatchEvent(new CustomEvent(`${resEvtName}/${seq}`, { detail: { seq, res } }));
        }
      })
      .catch((err: { error?: string }) => {
        window.dispatchEvent(new CustomEvent(`${errEvtName}/${seq}`, { detail: { seq, err } }));
      });
  };
  window.addEventListener(reqEvtName, eventHandler);

  const fn = (args: A): Promise<T> => {
    const seq = uuidv4();
    window.dispatchEvent(new CustomEvent(reqEvtName, { detail: { seq, req: args } }));
    return new Promise((resolve, reject) => {
      function resListener(evt: Event): void {
        const customEvt = evt as CustomEvent;
        const { res } = customEvt.detail;
        cleanup();
        resolve(res);
      }
      function errListener(evt: Event): void {
        const customEvt = evt as CustomEvent;
        const { err } = customEvt.detail;
        cleanup();
        reject(err);
      }
      function cleanup(): void {
        window.removeEventListener(`${resEvtName}/${seq}`, resListener);
        window.removeEventListener(`${errEvtName}/${seq}`, errListener);
      }
      window.addEventListener(`${resEvtName}/${seq}`, resListener);
      window.addEventListener(`${errEvtName}/${seq}`, errListener);
      if (!opts?.wait) {
        setTimeout(() => {
          cleanup();
          reject(new Error(`${handlerName} request timeout`));
        }, REQUEST_TIMEOUT_MS);
      }
    });
  };
  return fn;
}

// Check if running in browser extension environment
const isExtensionEnvironment = !!getBrowserAPI()?.runtime?.id;

// ============================================================================
// getCookies - Get Overleaf session cookies
// Office Add-in: Not needed, return empty values
// ============================================================================
let getCookies: (domain: string) => Promise<{ session: string; gclb: string }>;
if (import.meta.env.DEV) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getCookies = async (_domain: string) => {
    return {
      session: storage.getItem("pd.auth.overleafSession") ?? "",
      gclb: storage.getItem("pd.auth.gclb") ?? "",
    };
  };
} else if (isExtensionEnvironment) {
  getCookies = makeFunction<string, { session: string; gclb: string }>(HANDLER_NAMES.GET_COOKIES);
} else {
  // Office Add-in: Overleaf cookies not available/needed
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getCookies = async (_domain: string) => ({ session: "", gclb: "" });
}
export { getCookies };

// ============================================================================
// getUrl - Get extension resource URL
// Office Add-in: Return the path as-is (relative URL)
// ============================================================================
let getUrl: (path: string) => Promise<string>;
if (isExtensionEnvironment) {
  getUrl = makeFunction<string, string>(HANDLER_NAMES.GET_URL);
} else {
  // Office Add-in: Return path directly, resources are bundled with the add-in
  getUrl = async (path: string) => path;
}
export { getUrl };

// ============================================================================
// getOrCreateSessionId - Get or create analytics session ID
// Office Add-in: Use sessionStorage with in-memory fallback
// ============================================================================
let getOrCreateSessionId: () => Promise<string>;
if (isExtensionEnvironment) {
  getOrCreateSessionId = makeFunction<void, string>(HANDLER_NAMES.GET_OR_CREATE_SESSION_ID);
} else {
  const SESSION_EXPIRATION_IN_MIN = 30;
  const SESSION_STORAGE_KEY = "pd.sessionData";
  
  // In-memory fallback for environments where sessionStorage is not available
  let inMemorySessionData: { session_id: string; timestamp: number } | null = null;
  
  // Helper to safely access sessionStorage
  const getSessionStorageItem = (key: string): string | null => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  };
  
  const setSessionStorageItem = (key: string, value: string): void => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Ignore errors - we have in-memory fallback
    }
  };
  
  getOrCreateSessionId = async () => {
    const currentTimeInMs = Date.now();
    const storedData = getSessionStorageItem(SESSION_STORAGE_KEY);
    let sessionData: { session_id: string; timestamp: number } | null = storedData
      ? JSON.parse(storedData)
      : inMemorySessionData;

    if (sessionData && sessionData.timestamp) {
      const durationInMin = (currentTimeInMs - sessionData.timestamp) / 60000;
      if (durationInMin > SESSION_EXPIRATION_IN_MIN) {
        sessionData = null;
      } else {
        sessionData.timestamp = currentTimeInMs;
        setSessionStorageItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
        inMemorySessionData = sessionData;
      }
    }
    if (!sessionData) {
      sessionData = {
        session_id: currentTimeInMs.toString(),
        timestamp: currentTimeInMs,
      };
      setSessionStorageItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
      inMemorySessionData = sessionData;
    }
    return sessionData.session_id;
  };
}
export { getOrCreateSessionId };

// ============================================================================
// fetchImage - Fetch image and convert to base64
// Office Add-in: Use standard fetch API (no CORS issues in add-in context)
// ============================================================================
let fetchImage: (url: string) => Promise<string>;
if (isExtensionEnvironment) {
  fetchImage = makeFunction<string, string>(HANDLER_NAMES.FETCH_IMAGE);
} else {
  // Office Add-in: Direct fetch with base64 conversion
  fetchImage = async (url: string) => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };
}
export { fetchImage };

// ============================================================================
// requestHostPermission - Request browser extension host permissions
// Office Add-in: Not supported, always return false
// ============================================================================
let requestHostPermission: (origin: string) => Promise<boolean>;
if (isExtensionEnvironment) {
  requestHostPermission = makeFunction<string, boolean>(HANDLER_NAMES.REQUEST_HOST_PERMISSION);
} else {
  // Office Add-in: Permission requests not supported
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  requestHostPermission = async (_origin: string) => false;
}
export { requestHostPermission };
