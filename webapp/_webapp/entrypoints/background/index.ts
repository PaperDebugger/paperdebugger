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
import { HANDLER_NAMES, NATIVE_HOST_NAME, CHAT_STREAM_PORT } from "@/lib/constants";
import { syncContentScripts } from "./permissions";

// ─── Streamed chat over native messaging ───────────────────────────────────
// One long-lived native port to pd-host, shared across requests and routed by
// message `id`. Each content-script chat Port maps to one in-flight request.
type NativePort = ReturnType<typeof browser.runtime.connectNative>;
type Relay = { postMessage: (m: unknown) => void };
let nativePort: NativePort | null = null;
const inflight = new Map<string, Relay>();
const short = (id?: string) => (id ? id.slice(0, 8) : "-");

function getNativePort(): NativePort {
  if (nativePort) return nativePort;
  console.log(`[PD:bg] connecting native host ${NATIVE_HOST_NAME}…`);
  const port = browser.runtime.connectNative(NATIVE_HOST_NAME);
  port.onMessage.addListener((msg: { id?: string; type?: string; text?: string }) => {
    const extra = msg.type === "delta" ? ` (+${msg.text?.length ?? 0})` : "";
    console.log(`[PD:bg] host → ${msg.type} id=${short(msg.id)}${extra} → relay to content`);
    const relay = msg.id ? inflight.get(msg.id) : undefined;
    relay?.postMessage(msg);
    if (msg.id && (msg.type === "done" || msg.type === "error" || msg.type === "pong")) {
      inflight.delete(msg.id);
    }
  });
  port.onDisconnect.addListener(() => {
    const err = browser.runtime.lastError?.message || "host disconnected";
    console.log(`[PD:bg] native host disconnected: ${err} (inflight=${inflight.size})`);
    for (const [, relay] of inflight) relay.postMessage({ type: "error", message: err });
    inflight.clear();
    nativePort = null;
  });
  console.log(`[PD:bg] native host connected`);
  nativePort = port;
  return port;
}

function registerChatStreamPort() {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== CHAT_STREAM_PORT) return;
    console.log(`[PD:bg] content port connected`);
    let reqId: string | undefined;
    port.onMessage.addListener((req: { id?: string; type?: string; provider?: string }) => {
      reqId = req.id;
      console.log(
        `[PD:bg] content → req id=${short(reqId)} type=${req.type} provider=${req.provider ?? "-"} → forwarding to host`,
      );
      try {
        if (reqId) inflight.set(reqId, port);
        getNativePort().postMessage(req);
      } catch (err) {
        console.log(`[PD:bg] forward failed id=${short(reqId)}: ${String((err as Error)?.message ?? err)}`);
        port.postMessage({ type: "error", message: String((err as Error)?.message ?? err) });
      }
    });
    port.onDisconnect.addListener(() => {
      if (reqId) inflight.delete(reqId);
    });
  });
}

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

    registerChatStreamPort(); // streamed chat ⇄ local pd-host (native messaging)

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
