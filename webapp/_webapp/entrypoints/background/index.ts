/*
 * background/index.ts
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
import { HANDLER_NAMES } from "@/lib/constants";
import { syncContentScripts } from "./permissions";

export default defineBackground({
  // Set manifest options
  // persistent: undefined | true | false,
  // type: undefined | 'module',

  // Set include/exclude if the background should be removed from some builds
  // include: undefined | string[],
  // exclude: undefined | string[],

  main() {
    // Executed when background is loaded, CANNOT BE ASYNC
    syncContentScripts(); // service worker 启动时按已授权 origin 重建动态脚本
    browser.permissions.onAdded.addListener(syncContentScripts);
    browser.permissions.onRemoved.addListener(syncContentScripts);

    // Handlers reached via the ISOLATED bridge ({ action, args } -> response).
    // ponytail: only getUrl is live; cookies/sessionId/fetchImage land as their
    // impls are migrated.
    browser.runtime.onMessage.addListener((request: { action: string; args: unknown }) => {
      switch (request?.action) {
        case HANDLER_NAMES.GET_URL:
          return Promise.resolve((browser.runtime.getURL as (p: string) => string)(request.args as string));
      }
    });
  },
});
