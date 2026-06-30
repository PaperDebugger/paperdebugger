export type ChatProvider = "claude" | "codex";

export interface ChatRequest {
  id?: string;
  type: "chat";
  provider?: ChatProvider;
  prompt?: string;
  model?: string;
  resume?: string;
}

export type OnDelta = (text: string) => void;

export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
