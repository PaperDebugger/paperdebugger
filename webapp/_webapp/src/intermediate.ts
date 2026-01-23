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
 *
 * Architecture:
 * - intermediate.js runs in ISOLATED world (content script context)
 * - paperdebugger.js runs in MAIN world (page context)
 * - MAIN world cannot access chrome.runtime, so it sends window events
 * - ISOLATED world receives events, calls chrome.runtime, and sends response events back
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
 * Returns undefined if not running in an extension context (ISOLATED world).
 */
function getBrowserAPI(): typeof chrome | undefined {
  try {
    // @ts-expect-error: browser may not be defined in all environments
    const candidateBrowser = typeof browser !== "undefined" ? browser : undefined;
    if (candidateBrowser && typeof candidateBrowser.runtime?.sendMessage === "function") {
      return candidateBrowser;
    }
    const candidateChrome = typeof chrome !== "undefined" ? chrome : undefined;
    if (candidateChrome && typeof candidateChrome.runtime?.sendMessage === "function") {
      return candidateChrome;
    }
  } catch {
    // Not in extension context
  }
  return undefined;
}

/**
 * Check if running in Office Add-in environment
 */
function isOfficeEnvironment(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      "Office" in window &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof (window as any).Office?.context !== "undefined"
    );
  } catch {
    return false;
  }
}

// Check if we're in ISOLATED world (can access chrome.runtime.sendMessage)
const isIsolatedWorld = !!getBrowserAPI()?.runtime?.sendMessage;

/**
 * Create a function that communicates via window events.
 *
 * - In ISOLATED world: registers event handler that calls chrome.runtime.sendMessage
 * - In any world: returns a function that dispatches events and waits for response
 *
 * This allows MAIN world to call functions that require chrome.runtime access
 * by sending events to ISOLATED world.
 */
function makeFunction<A, T>(handlerName: string, opts?: MakeFunctionOpts): (args: A) => Promise<T> {
  const reqEvtName = `paperdebugger:req:${handlerName}`;
  const resEvtName = `paperdebugger:res:${handlerName}`;
  const errEvtName = `paperdebugger:err:${handlerName}`;

  // Only register the event handler in ISOLATED world (where chrome.runtime is available)
  if (isIsolatedWorld) {
    const eventHandler = (evt: Event) => {
      const browserAPI = getBrowserAPI();
      const customEvt = evt as CustomEvent;
      const { seq, req } = customEvt.detail;
      if (!seq) return;
      if (!browserAPI?.runtime?.sendMessage) return;
      browserAPI.runtime
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
  }

  // The callable function - works in both MAIN and ISOLATED world
  // Dispatches event and waits for response from ISOLATED world's handler
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

// ============================================================================
// getCookies - Get Overleaf session cookies
// ============================================================================
let getCookies: (domain: string) => Promise<{ session: string; gclb: string }>;
if (import.meta.env.DEV) {
  // Development: use local storage for testing
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getCookies = async (_domain: string) => {
    return {
      session: storage.getItem("pd.auth.overleafSession") ?? "",
      gclb: storage.getItem("pd.auth.gclb") ?? "",
    };
  };
} else if (isOfficeEnvironment()) {
  // Office Add-in: Overleaf cookies not available/needed
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getCookies = async (_domain: string) => ({ session: "", gclb: "" });
} else {
  // Browser extension (both MAIN and ISOLATED world):
  // Use event-based communication - ISOLATED world will handle chrome.runtime call
  getCookies = makeFunction<string, { session: string; gclb: string }>(HANDLER_NAMES.GET_COOKIES);
}
export { getCookies };

// ============================================================================
// getUrl - Get extension resource URL
// ============================================================================
let getUrl: (path: string) => Promise<string>;
if (isOfficeEnvironment()) {
  // Office Add-in: Return path directly, resources are bundled with the add-in
  getUrl = async (path: string) => path;
} else {
  // Browser extension: Use event-based communication
  getUrl = makeFunction<string, string>(HANDLER_NAMES.GET_URL);
}
export { getUrl };

// ============================================================================
// getOrCreateSessionId - Get or create analytics session ID
// ============================================================================
let getOrCreateSessionId: () => Promise<string>;
if (isOfficeEnvironment()) {
  // Office Add-in: Use sessionStorage with in-memory fallback
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
} else {
  // Browser extension: Use event-based communication
  getOrCreateSessionId = makeFunction<void, string>(HANDLER_NAMES.GET_OR_CREATE_SESSION_ID);
}
export { getOrCreateSessionId };

// ============================================================================
// fetchImage - Fetch image and convert to base64
// ============================================================================
let fetchImage: (url: string) => Promise<string>;
if (isOfficeEnvironment()) {
  // Office Add-in: Direct fetch with base64 conversion (no CORS issues in add-in context)
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
} else {
  // Browser extension: Use event-based communication
  fetchImage = makeFunction<string, string>(HANDLER_NAMES.FETCH_IMAGE);
}
export { fetchImage };

// ============================================================================
// requestHostPermission - Request browser extension host permissions
// ============================================================================
let requestHostPermission: (origin: string) => Promise<boolean>;
if (isOfficeEnvironment()) {
  // Office Add-in: Permission requests not supported
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  requestHostPermission = async (_origin: string) => false;
} else {
  // Browser extension: Use event-based communication
  requestHostPermission = makeFunction<string, boolean>(HANDLER_NAMES.REQUEST_HOST_PERMISSION);
}
export { requestHostPermission };
