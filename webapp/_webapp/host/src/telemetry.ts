// Per-turn usage telemetry → OTLP traces (VictoriaTraces behind otlp.xtra.science).
//
// One trace per chat turn, rooted at the moment the user hit send in the
// extension (req.t0 — browser and pd-host share the machine clock), with child
// spans for project sync, the extension→host bridge, and each runtime phase,
// so the waterfall shows where the wall-clock went. Root-span tags carry
// who/where/what (user, project.id, model, session.id) for filtering; turns of
// one conversation share session.id.
//
// Token: env OTEL_AUTH_TOKEN > ~/.paperdebugger/otel-token > baked-in default.
// The default ships in a public repo on purpose — it's an ingest-only key (like
// a Sentry DSN); secrecy isn't the security model, collector-side scoping is.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ChatRequest, TurnStat } from "./types.js";

const OTLP_TRACES = "https://otlp.xtra.science/v1/traces";

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
  const [{ BasicTracerProvider, SimpleSpanProcessor }, { OTLPTraceExporter }, { resourceFromAttributes }, api] =
    await Promise.all([
      import("@opentelemetry/sdk-trace-base"),
      import("@opentelemetry/exporter-trace-otlp-proto"),
      import("@opentelemetry/resources"),
      import("@opentelemetry/api"),
    ]);
  // ponytail: SimpleSpanProcessor, not Batch — one low-volume trace per chat
  // turn, and Chrome can kill pd-host anytime; batching would lose tails.
  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes({ "service.name": "pd-host", "service.namespace": "paperdebugger" }),
    spanProcessors: [
      new SimpleSpanProcessor(
        new OTLPTraceExporter({ url: OTLP_TRACES, headers: { Authorization: `Bearer ${readToken()}` } }),
      ),
    ],
  });
  return { provider, tracer: provider.getTracer("pd-host"), api, user: os.userInfo().username };
}
let ready: ReturnType<typeof init> | undefined;

// Fire-and-forget; never blocks or fails the turn. Call right after the turn's
// terminal message is sent — timings are reconstructed from that instant.
export function reportTurn(stat: TurnStat, req: ChatRequest, contId?: string): void {
  const tEnd = Date.now();
  (ready ??= init().catch((err) => {
    ready = undefined; // failed init (e.g. offline) retries on the next turn
    throw err;
  }))
    .then(({ tracer, api, user }) => {
      const tHost = tEnd - stat.totalMs; // host received the chat request
      // User hit send in the browser; fall back to host receipt if absent/skewed.
      const t0 = req.t0 && req.t0 <= tHost ? req.t0 : tHost;
      const root = tracer.startSpan(
        "chat_turn",
        {
          startTime: t0,
          kind: api.SpanKind.SERVER,
          attributes: {
            user,
            "project.id": req.projectId ?? "unknown",
            provider: stat.provider,
            model: stat.model || "cli-default",
            // convId is the extension-minted per-conversation key; contId
            // (claude sessionId / codex threadId) is a fallback for requests
            // from older extension builds.
            "session.id": req.convId ?? contId ?? "",
            ok: stat.ok,
            prompt_len: stat.promptLen,
            deltas: stat.deltas,
            chars: stat.chars,
            total_ms: stat.totalMs,
            ...(stat.ttftMs != null ? { ttft_ms: stat.ttftMs } : {}),
          },
        },
        api.ROOT_CONTEXT,
      );
      const ctx = api.trace.setSpan(api.ROOT_CONTEXT, root);
      const child = (name: string, start: number, end: number) => {
        if (end > start) tracer.startSpan(name, { startTime: start }, ctx).end(end);
      };
      if (req.syncMs) child("sync", t0, t0 + req.syncMs);
      child("bridge", t0 + (req.syncMs ?? 0), tHost);
      // Runtime phases are contiguous and end when the turn ends, so lay them
      // right-aligned from tEnd backwards (for codex they span the whole turn;
      // for claude the synthesized `streaming` starts at first token).
      let cursor = tEnd - stat.phases.reduce((s, p) => s + p.ms, 0);
      for (const p of stat.phases) {
        child(p.name, cursor, cursor + p.ms);
        cursor += p.ms;
      }
      if (stat.ttftMs != null) root.addEvent("first_token", undefined, tHost + stat.ttftMs);
      if (!stat.ok) root.setStatus({ code: api.SpanStatusCode.ERROR });
      root.end(tEnd);
    })
    .catch((err: unknown) => console.error("[pd-host] telemetry failed:", err));
}

// Bounded flush for shutdown: drains any in-flight span export but never holds
// the process hostage — resolves after `ms` even if the collector hangs.
export async function flushTelemetry(ms = 2000): Promise<void> {
  if (!ready) return;
  await Promise.race([
    ready.then(({ provider }) => provider.forceFlush()).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]);
}

// Self-check: `bun src/telemetry.ts` — sends one real trace through the full
// pipeline (init → spans → export) and flushes, so a failure is visible here.
if (process.argv[1]?.endsWith("telemetry.ts")) {
  reportTurn(
    {
      provider: "claude",
      model: "self-check",
      promptLen: 0,
      ttftMs: 400,
      totalMs: 1000,
      deltas: 0,
      chars: 0,
      phases: [{ name: "streaming", ms: 600 }],
      ok: true,
    },
    { type: "chat", projectId: "self-check", t0: Date.now() - 1500, syncMs: 300, convId: "self-check-conv" },
    "self-check-session",
  );
  const { provider } = await ready!;
  await provider.forceFlush();
  console.error("telemetry self-check ok — one trace flushed to collector");
}
