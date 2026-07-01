#!/usr/bin/env node
// PaperDebugger native-messaging host. Chrome launches this, speaks the
// 4-byte-length framed JSON protocol over stdin/stdout, and we bridge each chat
// request to the local Claude Code / Codex CLI, streaming text deltas back.
//
// Message protocol (extension ↔ host):
//   → { id, type: "ping" }                          ← { id, type: "pong" }
//   → { id, type: "chat", provider, prompt, model?, resume? }
//        ← { id, type: "reasoning", text }   (many, before the answer)
//        ← { id, type: "delta", text }   (many)
//        ← { id, type: "session", sessionId }   (claude, optional)
//        ← { id, type: "done", stat }  |  { id, type: "error", message, stat }
//          (stat = per-turn timing breakdown; see TurnStat)
import { decodeNativeMessages, encodeNativeMessage, type NativeMessage } from "./protocol.js";
import { runClaude } from "./runtimes/claude.js";
import { runCodex } from "./runtimes/codex.js";
import { syncProjectFiles } from "./sync.js";
import { errMessage, type ChatRequest, type Phase, type SyncRequest, type TurnStat } from "./types.js";

// CRITICAL: stdout is the wire to Chrome — any stray write corrupts the framing.
// Route all console.log to stderr so library logging can't break the protocol.
// Stamp every stderr line (incl. [codex]) with a local wall-clock time so the
// log has absolute timestamps alongside the relative @ms markers.
const stamp = () => {
  const d = new Date();
  return `${d.toLocaleTimeString("en-US", { hour12: false })}.${String(d.getMilliseconds()).padStart(3, "0")}`;
};
const rawError = console.error.bind(console);
console.error = (...args: unknown[]) => rawError(stamp(), ...args);
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
  if (type === "sync") {
    const req = msg as unknown as SyncRequest;
    const files = Array.isArray(req.files) ? req.files : [];
    const { written, deleted } = syncProjectFiles(req.projectId, files);
    log(
      `sync id=${short(id)} project=${req.projectId ?? "-"} in=${files.length} written=${written} deleted=${deleted}`,
    );
    send({ id, type: "done" });
    return;
  }
  if (type === "chat") {
    const req = msg as unknown as ChatRequest;
    const provider = req.provider ?? "claude";
    const t0 = Date.now();
    let deltas = 0;
    let chars = 0;
    let tFirst = 0;
    const onDelta = (text: string) => {
      deltas += 1;
      chars += text.length;
      if (deltas === 1) {
        tFirst = Date.now();
        log(`first token id=${short(id)} after ${tFirst - t0}ms`);
      }
      send({ id, type: "delta", text });
    };
    const onReasoning = (text: string) => send({ id, type: "reasoning", text });
    const resuming = req.resume ? ` resume=${short(req.resume)}` : "";
    log(
      `chat id=${short(id)} provider=${provider}${resuming} promptLen=${req.prompt?.length ?? 0} — invoking CLI, waiting for response…`,
    );
    // ponytail: stat is best-effort telemetry; assemble it the same way whether
    // the turn succeeded or threw, so the extension always gets a breakdown.
    const buildStat = (phases: Phase[], ok: boolean): TurnStat => {
      const totalMs = Date.now() - t0;
      const ttftMs = tFirst ? tFirst - t0 : undefined;
      // claude reports no phases → synthesize just `streaming` (first-token time
      // is already the ttft row, so a pre-first-token phase would duplicate it).
      let derived = phases;
      if (phases.length === 0 && ttftMs != null && totalMs > ttftMs) {
        derived = [{ name: "streaming", ms: totalMs - ttftMs }];
      }
      return { provider, model: req.model, promptLen: req.prompt?.length ?? 0, ttftMs, totalMs, deltas, chars, phases: derived, ok };
    };
    try {
      // Both runtimes return a continuation id (claude sessionId / codex threadId)
      // for the extension to store and pass back as `resume` next turn.
      const result =
        provider === "codex" ? await runCodex(req, onDelta, onReasoning) : await runClaude(req, onDelta, onReasoning);
      if (result.contId) send({ id, type: "session", sessionId: result.contId });
      const stat = buildStat(result.phases, true);
      log(`✓ done id=${short(id)} (${deltas} deltas, ${chars} chars, ${stat.totalMs}ms)`);
      send({ id, type: "done", stat });
    } catch (err) {
      log(`✗ error id=${short(id)}: ${errMessage(err)}`);
      send({ id, type: "error", message: errMessage(err), stat: buildStat([], false) });
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
