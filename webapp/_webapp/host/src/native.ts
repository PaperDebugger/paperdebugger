#!/usr/bin/env node
// PaperDebugger native-messaging host. Chrome launches this, speaks the
// 4-byte-length framed JSON protocol over stdin/stdout, and we bridge each chat
// request to the local Claude Code / Codex CLI, streaming text deltas back.
//
// Message protocol (extension ↔ host):
//   → { id, type: "ping" }                          ← { id, type: "pong" }
//   → { id, type: "chat", provider, prompt, model?, resume? }
//        ← { id, type: "delta", text }   (many)
//        ← { id, type: "session", sessionId }   (claude, optional)
//        ← { id, type: "done" }  |  { id, type: "error", message }
import { decodeNativeMessages, encodeNativeMessage, type NativeMessage } from "./protocol.js";
import { runClaude } from "./runtimes/claude.js";
import { runCodex } from "./runtimes/codex.js";
import { errMessage, type ChatRequest } from "./types.js";

// CRITICAL: stdout is the wire to Chrome — any stray write corrupts the framing.
// Route all console.log to stderr so library logging can't break the protocol.
console.log = (...args: unknown[]) => console.error("[pd-host:log]", ...args);

const send = (msg: NativeMessage) => process.stdout.write(encodeNativeMessage(msg));
const short = (id?: string) => (id ? id.slice(0, 8) : "-");
const log = (m: string) => console.error(`[pd-host] ${m}`);

async function handle(msg: NativeMessage): Promise<void> {
  const id = msg.id as string | undefined;
  const type = msg.type as string | undefined;
  log(`← received ${type} id=${short(id)}`);

  if (type === "ping") {
    log(`→ pong id=${short(id)}`);
    send({ id, type: "pong" });
    return;
  }
  if (type === "chat") {
    const req = msg as unknown as ChatRequest;
    const provider = req.provider ?? "claude";
    const t0 = Date.now();
    let deltas = 0;
    let chars = 0;
    const onDelta = (text: string) => {
      deltas += 1;
      chars += text.length;
      if (deltas === 1) log(`first token id=${short(id)} after ${Date.now() - t0}ms`);
      send({ id, type: "delta", text });
    };
    const resuming = req.resume ? ` resume=${short(req.resume)}` : "";
    log(
      `chat id=${short(id)} provider=${provider}${resuming} promptLen=${req.prompt?.length ?? 0} — invoking CLI, waiting for response…`,
    );
    try {
      // Both runtimes return a continuation id (claude sessionId / codex threadId)
      // for the extension to store and pass back as `resume` next turn.
      const contId = provider === "codex" ? await runCodex(req, onDelta) : await runClaude(req, onDelta);
      if (contId) send({ id, type: "session", sessionId: contId });
      log(`✓ done id=${short(id)} (${deltas} deltas, ${chars} chars, ${Date.now() - t0}ms)`);
      send({ id, type: "done" });
    } catch (err) {
      log(`✗ error id=${short(id)}: ${errMessage(err)}`);
      send({ id, type: "error", message: errMessage(err) });
    }
    return;
  }
  send({ id, type: "error", message: `unknown message type: ${String(type)}` });
}

let carry: Buffer = Buffer.alloc(0);
process.stdin.on("data", (chunk: Buffer) => {
  carry = Buffer.concat([carry, chunk]);
  const { messages, carry: rest } = decodeNativeMessages(carry);
  carry = rest;
  for (const msg of messages) {
    handle(msg).catch((err) => send({ id: msg?.id, type: "error", message: errMessage(err) }));
  }
});
process.stdin.on("end", () => process.exit(0));
