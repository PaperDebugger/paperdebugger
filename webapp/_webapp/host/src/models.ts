export type ModelInfo = { id: string; name: string };

// Claude aliases resolve to the latest model of each tier, so new releases work
// with no update here. Empty id = let the CLI use its own default.
const CLAUDE: ModelInfo[] = [
  { id: "", name: "Default" },
  { id: "opus", name: "Opus" },
  { id: "fable", name: "Fable" },
  { id: "sonnet", name: "Sonnet" },
  { id: "haiku", name: "Haiku" },
];

// Codex has no alias system; a small curated set.
// ponytail: refresh these ids when OpenAI ships new Codex models.
const CODEX: ModelInfo[] = [
  { id: "gpt-5.5", name: "gpt-5.5" },
  { id: "gpt-5.4", name: "gpt-5.4" },
  { id: "gpt-5.4-mini", name: "gpt-5.4-mini" },
  { id: "gpt-5.3-codex-spark", name: "gpt-5.3-codex-spark" },
];

export function listModels(provider?: string): ModelInfo[] {
  return provider === "codex" ? CODEX : CLAUDE;
}
