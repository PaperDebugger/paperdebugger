// Per-turn usage telemetry → OTLP logs (same collector as paperdebugger-main).
// The collector only accepts protobuf encoding, so this uses the OTel logs SDK
// with the -proto exporter (a plain JSON fetch gets 400'd).
//
// Each record answers: when (observedTimestamp) + who (os user) + which project
// (Overleaf projectId) + which model (provider/model) + latency breakdown
// (ttft_ms / total_ms / phase.*_ms from TurnStat).
//
// Token: env OTEL_AUTH_TOKEN > ~/.paperdebugger/otel-token > baked-in default.
// The default ships in a public repo on purpose — it's an ingest-only key (like
// a Sentry DSN); secrecy isn't the security model, collector-side scoping is.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TurnStat } from "./types.js";

const OTLP_LOGS = "https://otlp.xtra.science/v1/logs";

const DEFAULT_TOKEN = "ff4b3c7c2a66c5c9252696cf6cb111f79ff983d68700ff1051455cfe4ecf55ef";

function readToken(): string {
  if (process.env.OTEL_AUTH_TOKEN) return process.env.OTEL_AUTH_TOKEN;
  try {
    const t = fs.readFileSync(path.join(os.homedir(), ".paperdebugger", "otel-token"), "utf8").trim();
    if (t) return t;
  } catch {
    /* fall through */
  }
  return DEFAULT_TOKEN;
}

// The OTel packages cost ~100ms of module eval — noticeable on every host spawn
// (they'd delay the first pong), invisible after a multi-second chat turn. So
// they're dynamic-imported on first reportTurn instead of at module load.
async function init() {
  const [{ LoggerProvider, SimpleLogRecordProcessor }, { OTLPLogExporter }, { resourceFromAttributes }] =
    await Promise.all([
      import("@opentelemetry/sdk-logs"),
      import("@opentelemetry/exporter-logs-otlp-proto"),
      import("@opentelemetry/resources"),
    ]);
  // ponytail: SimpleLogRecordProcessor, not Batch — one low-volume record per
  // chat turn, and Chrome can kill pd-host anytime; batching would lose tails.
  const provider = new LoggerProvider({
    resource: resourceFromAttributes({ "service.name": "pd-host", "service.namespace": "paperdebugger" }),
    processors: [
      new SimpleLogRecordProcessor(
        new OTLPLogExporter({ url: OTLP_LOGS, headers: { Authorization: `Bearer ${readToken()}` } }),
      ),
    ],
  });
  return { provider, logger: provider.getLogger("pd-host"), user: os.userInfo().username };
}
let ready: ReturnType<typeof init> | undefined;

// Fire-and-forget; never blocks or fails the turn.
export function reportTurn(stat: TurnStat, projectId?: string): void {
  (ready ??= init())
    .then(({ logger, user }) =>
      logger.emit({
        severityText: "INFO",
        body: "chat_turn",
        attributes: {
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
        },
      }),
    )
    .catch((err: unknown) => console.error("[pd-host] telemetry failed:", err));
}

// Self-check: `bun src/telemetry.ts` — sends one real record through the full
// pipeline (init → emit → export) and flushes, so a failure is visible here.
if (process.argv[1]?.endsWith("telemetry.ts")) {
  reportTurn(
    {
      provider: "claude",
      model: "self-check",
      promptLen: 0,
      ttftMs: 1,
      totalMs: 2,
      deltas: 0,
      chars: 0,
      phases: [{ name: "streaming", ms: 1 }],
      ok: true,
    },
    "self-check",
  );
  const { provider } = await ready!;
  await provider.forceFlush();
  console.error("telemetry self-check ok — smoke record flushed to collector");
}
