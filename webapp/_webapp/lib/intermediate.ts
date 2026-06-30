/*
 * intermediate.ts — message broker between MAIN world (UI) and the background.
 *
 * +-----------------+   chrome   +-------------------+    window   +---------------------+
 * |  background.js  | <--------> |  intermediate.js  | <---------> |  content_script.js  |
 * +-----------------+            +-------------------+             +---------------------+
 * - fetch cookies                - message broker                  - UI
 * - get google auth token        - ISOLATED world                  - MAIN world
 *                                - Listener: chrome.runtime        - Listener: window
 *
 * - The ISOLATED content script imports this module for its side effect: each
 *   makeFunction() registers a window listener that forwards to chrome.runtime.
 * - The MAIN-world injected script imports the callables; with no chrome.runtime
 *   there, they dispatch window events the ISOLATED side answers.
 */
import { HANDLER_NAMES } from "./constants";

const REQUEST_TIMEOUT_MS = 5000;

export type MakeFunctionOpts = {
  wait?: boolean;
};

/**
 * Get the extension API off the GLOBAL (not WXT's auto-imported `browser`, which
 * is a module binding and would look "defined" even in MAIN world). Returns
 * undefined in MAIN world / page context.
 */
type ExtApi = { runtime?: { sendMessage?: (msg: unknown) => Promise<{ error?: string }> } };
function getBrowserAPI(): ExtApi | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    if (g.browser && typeof g.browser.runtime?.sendMessage === "function") {
      return g.browser;
    }
    if (g.chrome && typeof g.chrome.runtime?.sendMessage === "function") {
      return g.chrome;
    }
  } catch {
    // Not in extension context
  }
  return undefined;
}

// Can we reach chrome.runtime.sendMessage? True in ISOLATED world, false in MAIN.
const isIsolatedWorld = !!getBrowserAPI()?.runtime?.sendMessage;

/**
 * Create a function that communicates via window events.
 *
 * - In ISOLATED world: registers event handler that calls chrome.runtime.sendMessage
 * - In any world: returns a function that dispatches events and waits for response
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
          if (res?.error) {
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
    const seq = crypto.randomUUID();
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

// Browser-extension handlers. Defining each registers its ISOLATED-world bridge
// listener. Only the ones with a live background handler resolve today; the rest
// land as their background side is migrated. (Office/dev branches dropped — this
// is the browser extension, not the Office add-in.)
export const getCookies = makeFunction<string, { session: string; gclb: string }>(HANDLER_NAMES.GET_COOKIES);
export const getUrl = makeFunction<string, string>(HANDLER_NAMES.GET_URL);
export const getOrCreateSessionId = makeFunction<void, string>(HANDLER_NAMES.GET_OR_CREATE_SESSION_ID);
export const fetchImage = makeFunction<string, string>(HANDLER_NAMES.FETCH_IMAGE);
export const requestHostPermission = makeFunction<string, boolean>(HANDLER_NAMES.REQUEST_HOST_PERMISSION);
