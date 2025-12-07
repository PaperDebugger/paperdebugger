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

const REQUEST_TIMEOUT_MS = 5000;

export type MakeFunctionOpts = {
  wait?: boolean;
};

function makeFunction<A, T>(handlerName: string, opts?: MakeFunctionOpts): (args: A) => Promise<T> {
  const reqEvtName = `paperdebugger:req:${handlerName}`;
  const resEvtName = `paperdebugger:res:${handlerName}`;
  const errEvtName = `paperdebugger:err:${handlerName}`;

  const eventHandler = (evt: Event) => {
    // @ts-expect-error: browser may not be defined in all environments
    const browserAPI = typeof browser !== "undefined" ? browser : chrome;
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

let getCookies: (domain: string) => Promise<{ session: string; gclb: string }>;
if (import.meta.env.DEV) {
  getCookies = async (_: string) => {
    return {
      session: localStorage.getItem("pd.auth.overleafSession") ?? "",
      gclb: localStorage.getItem("pd.auth.gclb") ?? "",
    };
  };
} else {
  getCookies = makeFunction<string, { session: string; gclb: string }>(HANDLER_NAMES.GET_COOKIES);
}

export { getCookies };
export const getUrl = makeFunction<string, string>(HANDLER_NAMES.GET_URL);
export const getOrCreateSessionId = makeFunction<void, string>(HANDLER_NAMES.GET_OR_CREATE_SESSION_ID);
export const fetchImage = makeFunction<string, string>(HANDLER_NAMES.FETCH_IMAGE);
