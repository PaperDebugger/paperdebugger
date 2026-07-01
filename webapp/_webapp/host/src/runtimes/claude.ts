import { query } from "@anthropic-ai/claude-agent-sdk";
import { workspaceDir } from "../workspace.js";
import { span, type ChatRequest, type OnDelta, type Phase, type RuntimeResult } from "../types.js";

// Just the fields we read off the SDK message stream.
type StreamMessage = {
  type?: string;
  subtype?: string;
  session_id?: string;
  message?: { content?: { type?: string }[] };
  event?: { type?: string; delta?: { type?: string; text?: string; thinking?: string } };
};

// Drive Claude Code via the agent SDK. The SDK spawns the user's `claude` CLI,
// so it reuses their existing login / skills / MCP. Tool calls run autonomously
// (bypassPermissions) since there's no approval UI yet. Returns the SDK session
// id (for resuming later) plus a phase breakdown.
//
// Resilient resume: a stored session can go stale (host restarted, session
// expired), and the SDK then errors with "No conversation found". If that
// happens before we've streamed anything, we retry once as a fresh session —
// mirrors codex's thread/resume → thread/start fallback.
export async function runClaude(msg: ChatRequest, onDelta: OnDelta, onReasoning: OnDelta): Promise<RuntimeResult> {
  let streamed = false;
  const d = (t: string) => {
    streamed = true;
    onDelta(t);
  };
  const r = (t: string) => {
    streamed = true;
    onReasoning(t);
  };
  const resume = msg.resume?.trim() || undefined;
  try {
    return await stream(msg, resume, d, r);
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    if (resume && !streamed && /No conversation found|session ID/i.test(text)) {
      return await stream(msg, undefined, d, r); // stale session → fresh
    }
    throw err;
  }
}

async function stream(
  msg: ChatRequest,
  resume: string | undefined,
  onDelta: OnDelta,
  onReasoning: OnDelta,
): Promise<RuntimeResult> {
  const response = query({
    prompt: String(msg.prompt ?? ""),
    options: {
      ...(msg.model ? { model: msg.model } : {}),
      cwd: workspaceDir(msg.projectId),
      permissionMode: "bypassPermissions",
      includePartialMessages: true,
      ...(resume ? { resume } : {}),
    },
  });

  const t0 = Date.now();
  const at = () => Date.now() - t0;
  const has = (m: StreamMessage, t: string) => m.message?.content?.some((c) => c.type === t) ?? false;

  let sessionId: string | undefined;
  // Milestones (ms from entry). Most fire before the first answer token.
  let firstMsgMs = 0; // first SDK message — `claude` CLI has booted
  let firstHookMs = 0; // first SessionStart hook_started (before init)
  let lastHookMs = 0; // last hook_response before init
  let initMs = 0; // system/init — SDK ready
  let firstToolMs = 0; // first tool_use the model requests
  let lastToolMs = 0; // last tool_result returned
  let firstTokenMs = 0;

  for await (const raw of response) {
    const m = raw as unknown as StreamMessage;
    // Diagnostic: log every non-delta SDK message with a timestamp (skip the
    // high-frequency stream_event deltas). Mirrors codex's [codex] event log.
    if (m.type !== "stream_event") console.error(`[claude] ${m.type ?? "?"}${m.subtype ? "/" + m.subtype : ""} @${at()}ms`);
    if (!firstMsgMs) firstMsgMs = at(); // reaching the first message = CLI cold-start done
    if (m.session_id && !sessionId) sessionId = m.session_id;
    if (m.type === "system" && !initMs) {
      if (m.subtype === "hook_started" && !firstHookMs) firstHookMs = at();
      else if (m.subtype === "hook_response") lastHookMs = at();
      else if (m.subtype === "init") initMs = at();
    }
    if (!firstTokenMs && m.type === "assistant" && has(m, "tool_use") && !firstToolMs) firstToolMs = at();
    if (!firstTokenMs && m.type === "user" && has(m, "tool_result")) lastToolMs = at();
    if (m.type === "stream_event" && m.event?.type === "content_block_delta") {
      const d = m.event.delta;
      if (d?.type === "text_delta" && d.text) {
        if (!firstTokenMs) firstTokenMs = at();
        onDelta(d.text);
      } else if (d?.type === "thinking_delta" && d.thinking) onReasoning(d.thinking);
    }
  }

  // Non-overlapping phases that sum to the total. The old lumped "startup" splits
  // into spawn (CLI cold-start, usually the big one) / hooks / init. `pre-answer`
  // is init→first token: API round-trip + server prefill + any extended thinking
  // — we can't tell those apart from outside, so don't call it "reasoning".
  const doneMs = at();
  const ft = firstTokenMs || doneMs;
  const hooksMs = span(firstHookMs, lastHookMs);
  const toolsMs = span(firstToolMs, lastToolMs);
  const phases: Phase[] = [
    { name: "spawn", ms: firstMsgMs },
    { name: "hooks", ms: hooksMs },
    { name: "init", ms: Math.max(0, initMs - (lastHookMs || firstMsgMs)) },
    { name: "tools", ms: toolsMs },
    { name: "pre-answer", ms: Math.max(0, ft - initMs - toolsMs) },
    { name: "streaming", ms: firstTokenMs ? doneMs - firstTokenMs : 0 },
  ].filter((p) => p.ms > 0);
  return { contId: sessionId, phases };
}
