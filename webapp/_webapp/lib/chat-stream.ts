/*
 * chat-stream.ts — streamed chat bridge, MAIN world (UI) ⇄ background ⇄ host.
 *
 * The intermediate.ts bridge is one-shot request/response. Chat needs a stream
 * of deltas, so this opens a long-lived runtime Port instead:
 *
 *   MAIN world (assistant-ui adapter)
 *     └─ window event ─→ ISOLATED content script
 *                          └─ chrome.runtime.connect(CHAT_STREAM_PORT) ─→ background
 *                                                                           └─ connectNative ─→ pd-host
 *
 * Each streamed host message (delta / session / done / error / pong) flows back
 * the same path. Importing this module in the ISOLATED world registers the relay.
 */
import { CHAT_STREAM_PORT } from "./constants";

export type ChatProvider = "claude" | "codex";

export type ChatStreamRequest = {
  type: "chat" | "ping";
  provider?: ChatProvider;
  prompt?: string;
  model?: string;
  resume?: string;
};

export type ChatStreamMessage =
  | { type: "delta"; text: string }
  | { type: "session"; sessionId: string }
  | { type: "pong" }
  | { type: "done" }
  | { type: "error"; message: string };

const REQ_EVT = "paperdebugger:chat:req";
const msgEvt = (seq: string) => `paperdebugger:chat:msg/${seq}`;
const isTerminal = (t: ChatStreamMessage["type"]) => t === "done" || t === "error" || t === "pong";

// Extension API off the global (undefined in MAIN world / page context).
type Port = {
  postMessage: (msg: unknown) => void;
  disconnect: () => void;
  onMessage: { addListener: (cb: (msg: ChatStreamMessage) => void) => void };
  onDisconnect: { addListener: (cb: () => void) => void };
};
type ExtApi = { runtime?: { connect?: (info: { name: string }) => Port } };
function getBrowserAPI(): ExtApi | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (typeof g.browser?.runtime?.connect === "function") return g.browser;
  if (typeof g.chrome?.runtime?.connect === "function") return g.chrome;
  return undefined;
}

const short = (id: string) => id.slice(0, 8);

// ISOLATED world only: bridge window events ⇄ a background Port per request.
if (getBrowserAPI()?.runtime?.connect) {
  window.addEventListener(REQ_EVT, (evt) => {
    const { seq, req } = (evt as CustomEvent).detail as { seq: string; req: ChatStreamRequest };
    console.log(`[PD:iso] req id=${short(seq)} type=${req.type} → opening port to background`);
    const port = getBrowserAPI()!.runtime!.connect!({ name: CHAT_STREAM_PORT });
    const relay = (msg: ChatStreamMessage) => window.dispatchEvent(new CustomEvent(msgEvt(seq), { detail: msg }));
    let finished = false;
    port.onMessage.addListener((msg) => {
      console.log(`[PD:iso] bg → ${msg.type} id=${short(seq)}${msg.type === "delta" ? ` (+${msg.text.length})` : ""} → relaying to UI`);
      relay(msg);
      if (isTerminal(msg.type)) {
        finished = true;
        port.disconnect();
      }
    });
    port.onDisconnect.addListener(() => {
      console.log(`[PD:iso] port disconnected id=${short(seq)} finished=${finished}`);
      if (!finished) relay({ type: "error", message: "Local host disconnected. Is pd-host installed?" });
    });
    console.log(`[PD:iso] → posting req to background id=${short(seq)}`);
    port.postMessage({ ...req, id: seq });
  });
}

/**
 * Send a chat (or ping) request and receive streamed messages via `onMessage`.
 * Resolves on `done`/`pong`, rejects on `error`. Works from MAIN or ISOLATED.
 */
export function chatStream(req: ChatStreamRequest, onMessage: (msg: ChatStreamMessage) => void): Promise<void> {
  const seq = crypto.randomUUID();
  const t0 = performance.now();
  const ms = () => `${Math.round(performance.now() - t0)}ms`;
  return new Promise((resolve, reject) => {
    const listener = (evt: Event) => {
      const msg = (evt as CustomEvent).detail as ChatStreamMessage;
      if (msg.type === "error") {
        console.log(`[PD:ui] ✗ error id=${short(seq)} @${ms()}: ${msg.message}`);
        cleanup();
        reject(new Error(msg.message));
      } else if (isTerminal(msg.type)) {
        console.log(`[PD:ui] ✓ ${msg.type} id=${short(seq)} @${ms()}`);
        cleanup();
        resolve();
      } else {
        console.log(`[PD:ui] ← ${msg.type} id=${short(seq)} @${ms()}${msg.type === "delta" ? ` (+${msg.text.length})` : ""}`);
        onMessage(msg);
      }
    };
    const cleanup = () => window.removeEventListener(msgEvt(seq), listener);
    window.addEventListener(msgEvt(seq), listener);
    console.log(`[PD:ui] → send id=${short(seq)} type=${req.type} provider=${req.provider ?? "-"} promptLen=${req.prompt?.length ?? 0}`);
    window.dispatchEvent(new CustomEvent(REQ_EVT, { detail: { seq, req } }));
  });
}
