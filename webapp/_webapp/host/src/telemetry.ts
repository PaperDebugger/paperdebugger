// Per-turn usage telemetry → OTLP logs (same collector as paperdebugger-main).
// The collector only accepts protobuf encoding, so this uses the OTel logs SDK
// with the -proto exporter (a plain JSON fetch gets 400'd).
//
// Each record answers: when (observedTimestamp) + who (os user) + which project
// (Overleaf projectId) + which model (provider/model) + latency breakdown
// (ttft_ms / total_ms / phase.*_ms from TurnStat).
//
// Disabled unless a token exists: env OTEL_AUTH_TOKEN or ~/.paperdebugger/otel-token.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import type { TurnStat } from "./types.js";

const OTLP_LOGS = "https://otlp.xtra.science/v1/logs";

function readToken(): string | undefined {
  if (process.env.OTEL_AUTH_TOKEN) return process.env.OTEL_AUTH_TOKEN;
  try {
    return fs.readFileSync(path.join(os.homedir(), ".paperdebugger", "otel-token"), "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}
const TOKEN = readToken();

// ponytail: SimpleLogRecordProcessor, not Batch — one low-volume record per chat
// turn, and pd-host can be killed by Chrome anytime; batching would lose tails.
const logger = TOKEN
  ? new LoggerProvider({
      resource: resourceFromAttributes({ "service.name": "pd-host", "service.namespace": "paperdebugger" }),
      processors: [
        new SimpleLogRecordProcessor(
          new OTLPLogExporter({ url: OTLP_LOGS, headers: { Authorization: `Bearer ${TOKEN}` } }),
        ),
      ],
    }).getLogger("pd-host")
  : null;

// Pure attribute builder (exported for the self-check below).
export function turnAttributes(
  stat: TurnStat,
  projectId: string | undefined,
  user: string,
): Record<string, string | number | boolean> {
  return {
    user,
    "project.id": projectId ?? "unknown",
    provider: stat.provider,
    model: stat.model || "cli-default",
    ok: stat.ok,
    prompt_len: stat.promptLen,
    deltas: stat.deltas,
    chars: stat.chars,
    total_ms: stat.totalMs,
    ...(stat.ttftMs != null ? { ttft_ms: stat.ttftMs } : {}),
    ...Object.fromEntries(stat.phases.map((p) => [`phase.${p.name}_ms`, Math.round(p.ms)])),
  };
}

// Fire-and-forget; never blocks or fails the turn.
export function reportTurn(stat: TurnStat, projectId?: string): void {
  logger?.emit({
    severityText: "INFO",
    body: "chat_turn",
    attributes: turnAttributes(stat, projectId, os.userInfo().username),
  });
}

// Self-check: `bun src/telemetry.ts` (with a token this also sends one real record)
if (process.argv[1]?.endsWith("telemetry.ts")) {
  const attrs = turnAttributes(
    {
      provider: "claude",
      model: "opus",
      promptLen: 12,
      ttftMs: 800,
      totalMs: 2000,
      deltas: 5,
      chars: 300,
      phases: [{ name: "streaming", ms: 1200 }],
      ok: true,
    },
    "abc123abc123abc123abc123",
    "junyi",
  );
  console.assert(attrs.user === "junyi", "user");
  console.assert(attrs.model === "opus", "model");
  console.assert(attrs.ttft_ms === 800, "ttft");
  console.assert(attrs["phase.streaming_ms"] === 1200, "phase");
  console.error(`telemetry self-check ok (reporting ${TOKEN ? "enabled" : "disabled — no token"})`);
}
