export type ChatProvider = "claude" | "codex";

export interface ChatRequest {
  id?: string;
  type: "chat";
  provider?: ChatProvider;
  prompt?: string;
  model?: string;
  resume?: string;
  // Overleaf project id → per-project workspace + session isolation.
  projectId?: string;
  // Telemetry: when the user hit send in the browser (epoch ms, same machine
  // clock as the host), how long the preceding project sync took, and a stable
  // per-conversation id (claude re-mints sessionId on resume, so contId can't
  // group a conversation's turns).
  t0?: number;
  syncMs?: number;
  convId?: string;
}

export interface SyncRequest {
  id?: string;
  type: "sync";
  projectId?: string;
  // content is utf8 text by default; binaries (images/PDF) are base64-encoded.
  files: { path: string; content: string; encoding?: "utf8" | "base64" }[];
  // Present on the final batch of a full sync: the complete set of wanted paths.
  // The host deletes any workspace file not listed. Absent → write-only (no prune).
  prune?: string[];
}

export type OnDelta = (text: string) => void;

// Named duration (ms) of one phase of a turn. Ordered; sums ≈ total. Codex fills
// a detailed breakdown (startup/thread/mcp/reasoning/streaming); claude can only
// observe first-token vs streaming, so native synthesizes those.
export interface Phase {
  name: string;
  ms: number;
}

// Duration of a phase bounded by two milestones (ms from turn entry). Returns 0
// unless both fired and end came after start — a missing milestone drops the phase.
export const span = (start: number, end: number): number => (start && end > start ? end - start : 0);

// What a runtime returns to native after one turn.
export interface RuntimeResult {
  contId?: string; // claude sessionId / codex threadId, for resuming
  phases: Phase[];
}

// Per-turn timing, attached to the `done` message so the extension can see what
// drove TTFT for each provider without a separate fetch.
export interface TurnStat {
  provider: ChatProvider;
  model?: string;
  promptLen: number;
  ttftMs?: number; // host received chat → first delta
  totalMs: number; // host received chat → done
  deltas: number;
  chars: number;
  phases: Phase[];
  ok: boolean;
}

export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
