import { create } from "zustand";
import type { TurnStat } from "@/lib/chat-stream";

// In-memory only: recent per-turn timing breakdowns, newest first. Not persisted
// — this is live debugging telemetry, not user data. ponytail: keep last 20, a
// flat array is plenty at this size.
const MAX = 20;

interface ChatStatsStore {
  turns: TurnStat[];
  add: (t: TurnStat) => void;
  clear: () => void;
}

export const useChatStatsStore = create<ChatStatsStore>((set) => ({
  turns: [],
  add: (t) => set((s) => ({ turns: [t, ...s.turns].slice(0, MAX) })),
  clear: () => set({ turns: [] }),
}));
