import { query } from "@anthropic-ai/claude-agent-sdk";
import { workspaceDir } from "../workspace.js";
import type { ChatRequest, OnDelta } from "../types.js";

// Just the fields we read off the SDK message stream.
type StreamMessage = {
  type?: string;
  session_id?: string;
  event?: { type?: string; delta?: { type?: string; text?: string } };
};

// Drive Claude Code via the agent SDK. The SDK spawns the user's `claude` CLI,
// so it reuses their existing login / skills / MCP. We stream text deltas only;
// tool calls run autonomously (bypassPermissions) since there's no approval UI yet.
// Returns the SDK session id (for resuming the conversation later), if any.
export async function runClaude(msg: ChatRequest, onDelta: OnDelta): Promise<string | undefined> {
  const response = query({
    prompt: String(msg.prompt ?? ""),
    options: {
      ...(msg.model ? { model: msg.model } : {}),
      cwd: workspaceDir(),
      permissionMode: "bypassPermissions",
      includePartialMessages: true,
      ...(msg.resume ? { resume: String(msg.resume) } : {}),
    },
  });

  let sessionId: string | undefined;
  for await (const raw of response) {
    const m = raw as unknown as StreamMessage;
    if (m.session_id && !sessionId) sessionId = m.session_id;
    if (m.type === "stream_event" && m.event?.type === "content_block_delta" && m.event.delta?.type === "text_delta") {
      const text = m.event.delta.text ?? "";
      if (text) onDelta(text);
    }
  }
  return sessionId;
}
