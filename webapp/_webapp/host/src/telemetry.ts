// Per-turn usage telemetry → OTLP logs (same collector as paperdebugger-main).
// One fetch POST of OTLP/HTTP JSON per chat turn — no OpenTelemetry SDK.
// ponytail: plain fetch + JSON covers one event type; add the SDK only if we
// ever need traces/metrics with propagation.
//
// Each record answers: when (timeUnixNano) + who (os user) + which project
// (Overleaf projectId) + which model (provider/model) + latency breakdown
// (ttft_ms / total_ms / phase.*_ms from TurnStat).
//
// Disabled unless a token exists: env OTEL_AUTH_TOKEN or ~/.paperdebugger/otel-token.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

type Attr = { key: string; value: { stringValue: string } | { intValue: string } | { boolValue: boolean } };
const str = (key: string, v: string): Attr => ({ key, value: { stringValue: v } });
const int = (key: string, v: number): Attr => ({ key, value: { intValue: String(Math.round(v)) } });

// Pure payload builder (exported for the self-check below).
export function turnPayload(stat: TurnStat, projectId: string | undefined, user: string, nowMs: number) {
  const attributes: Attr[] = [
    str("user", user),
    str("project.id", projectId ?? "unknown"),
    str("provider", stat.provider),
    str("model", stat.model || "cli-default"),
    { key: "ok", value: { boolValue: stat.ok } },
    int("prompt_len", stat.promptLen),
    int("deltas", stat.deltas),
    int("chars", stat.chars),
    int("total_ms", stat.totalMs),
    ...(stat.ttftMs != null ? [int("ttft_ms", stat.ttftMs)] : []),
    ...stat.phases.map((p) => int(`phase.${p.name}_ms`, p.ms)),
  ];
  return {
    resourceLogs: [
      {
        resource: {
          attributes: [str("service.name", "pd-host"), str("service.namespace", "paperdebugger")],
        },
        scopeLogs: [
          {
            scope: { name: "pd-host" },
            logRecords: [
              {
                timeUnixNano: `${nowMs}000000`,
                severityText: "INFO",
                body: { stringValue: "chat_turn" },
                attributes,
              },
            ],
          },
        ],
      },
    ],
  };
}

// Fire-and-forget; never blocks or fails the turn.
export function reportTurn(stat: TurnStat, projectId?: string): void {
  if (!TOKEN) return;
  fetch(OTLP_LOGS, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(turnPayload(stat, projectId, os.userInfo().username, Date.now())),
  }).catch((err: unknown) => console.error("[pd-host] telemetry send failed:", err));
}

// Self-check: `bun src/telemetry.ts`
if (process.argv[1]?.endsWith("telemetry.ts")) {
  const p = turnPayload(
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
    1700000000000,
  );
  const rec = p.resourceLogs[0].scopeLogs[0].logRecords[0];
  const get = (k: string) => rec.attributes.find((a) => a.key === k)?.value;
  console.assert(rec.timeUnixNano === "1700000000000000000", "time");
  console.assert(JSON.stringify(get("user")) === '{"stringValue":"junyi"}', "user");
  console.assert(JSON.stringify(get("model")) === '{"stringValue":"opus"}', "model");
  console.assert(JSON.stringify(get("ttft_ms")) === '{"intValue":"800"}', "ttft");
  console.assert(JSON.stringify(get("phase.streaming_ms")) === '{"intValue":"1200"}', "phase");
  console.error("telemetry self-check ok");
}
