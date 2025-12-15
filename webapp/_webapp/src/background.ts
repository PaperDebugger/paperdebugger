/*
 * background.ts
 *
 * +-----------------+            +-------------------+             +---------------------+
 * |  background.js  | <--------> |  intermediate.js  | <---------> |  content_script.js  |
 * +-----------------+            +-------------------+             +---------------------+
 * - fetch cookies                - message broker                  - UI
 * - get google auth token        - ISOLATED world                  - MAIN world
 *                                - Listener: chrome.runtime        - Listener: window
 *
 * This file is responsible for handling background tasks, such as fetching
 * cookies and Google auth tokens.
 *
 * The core function is `chrome.runtime.onMessage.addListener`
 * and `sendResponse` to send a response back to the content script (intermediate.js).
 */
import { getAllCookies } from "./libs/browser";
import { HANDLER_NAMES } from "./shared/constants";
import { blobToBase64 } from "./libs/helpers";
import { registerContentScripts } from "./libs/permissions";

export type Handler<A, T> = {
  name: string;
  handler: (args: A, sendResponse: (response: T) => void) => Promise<void>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HandlerAny = Handler<any, any>;

export const getCookiesHandler: Handler<string, { session?: string; gclb?: string }> = {
  name: HANDLER_NAMES.GET_COOKIES,
  handler: async (domain: string, sendResponse) => {
    const cookies = await getAllCookies("overleaf_session2", "https://" + domain);
    const gclb = await getAllCookies("GCLB", "https://" + domain);
    sendResponse({ session: cookies[0]?.value, gclb: gclb[0]?.value });
  },
};

export const getUrlHandler: Handler<string, string> = {
  name: HANDLER_NAMES.GET_URL,
  handler: async (path, sendResponse) => {
    sendResponse(chrome.runtime.getURL(path));
  },
};

export const getOrCreateSessionIdHandler: Handler<void, string> = {
  name: HANDLER_NAMES.GET_OR_CREATE_SESSION_ID,
  handler: async (_, sendResponse) => {
    const SESSION_EXPIRATION_IN_MIN = 30;
    const currentTimeInMs = Date.now();

    let { sessionData } = await chrome.storage.session.get("sessionData"); // Use storage.session because it is only in memory
    if (sessionData && sessionData.timestamp) {
      const durationInMin = (currentTimeInMs - sessionData.timestamp) / 60000;
      if (durationInMin > SESSION_EXPIRATION_IN_MIN) {
        sessionData = null;
      } else {
        sessionData.timestamp = currentTimeInMs;
        await chrome.storage.session.set({ sessionData });
      }
    }
    if (!sessionData) {
      sessionData = {
        session_id: currentTimeInMs.toString(),
        timestamp: currentTimeInMs.toString(),
      };
      await chrome.storage.session.set({ sessionData });
    }
    sendResponse(sessionData.session_id);
  },
};

export const fetchImageHandler: Handler<string, string> = {
  name: HANDLER_NAMES.FETCH_IMAGE,
  handler: async (url, sendResponse) => {
    const response = await fetch(url);
    const blob = await response.blob();
    sendResponse(await blobToBase64(blob));
  },
};

const registerContentScriptsIfPermitted = async () => {
  try {
    const { origins = [] } = await chrome.permissions.getAll();
    if (!origins.length) {
      // eslint-disable-next-line no-console
      console.log("[PaperDebugger] No origins found, skipping content script registration");
      return;
    }
    await registerContentScripts(origins);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[PaperDebugger] Unable to register content scripts", error);
  }
};

export const requestHostPermissionHandler: Handler<string, boolean> = {
  name: HANDLER_NAMES.REQUEST_HOST_PERMISSION,
  handler: async (origin, sendResponse) => {
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (granted) {
      // chrome.permissions.request requires a user gesture context, the requestHostPermissionHandler is in the background script
      // and called via async messaging from the settings page.
      // Here we must register content scripts because when a message is sent through chrome.runtime.sendMessage,
      // the user gesture context is not preserved in the background script handler,
      // causing the permission request to fail with "This function must be called during a user gesture."
      // The permission request needs to be called directly from the settings page where the user click occurs,
      // not delegated to the background script.
      // Therefore, we must register content scripts here.
      await registerContentScriptsIfPermitted();
    }
    sendResponse(granted);
  },
};

// @ts-expect-error: browser may not be defined in all environments
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

browserAPI.runtime?.onMessage?.addListener(
  (request: { action: string; args: unknown }, _: unknown, sendResponse: (response: unknown) => void) => {
    const handlers = [
      getCookiesHandler,
      getUrlHandler,
      getOrCreateSessionIdHandler,
      fetchImageHandler,
      requestHostPermissionHandler,
    ];

    const handler = handlers.find((h) => h.name === request.action) as HandlerAny;
    if (!handler) {
      return true;
    }

    (async () => {
      try {
        await handler.handler?.(request.args, sendResponse);
      } catch (e) {
        sendResponse({ error: e });
      }
    })();
    return true;
  },
);

registerContentScriptsIfPermitted();
