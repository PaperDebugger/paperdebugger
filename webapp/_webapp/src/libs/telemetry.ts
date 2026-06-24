import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { WebTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-web";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { LoggerProvider, BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { onCLS, onINP, onLCP } from "web-vitals";
import { getManifest } from "./manifest";

const OTLP = "https://otlp.xtra.science";
const headers = { Authorization: `Bearer ${process.env.OTEL_AUTH_TOKEN}` };

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: "paperdebugger",
  [ATTR_SERVICE_VERSION]: getManifest().version,
  "service.namespace": "paperdebugger",
  "deployment.environment": "prod",
});

// Traces
new WebTracerProvider({
  resource,
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: `${OTLP}/v1/traces`, headers }))],
}).register();

// Logs
const logger = new LoggerProvider({
  resource,
  processors: [new BatchLogRecordProcessor(new OTLPLogExporter({ url: `${OTLP}/v1/logs`, headers }))],
}).getLogger("paperdebugger");

// Metrics
const meter = new MeterProvider({
  resource,
  readers: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${OTLP}/v1/metrics`, headers }),
      exportIntervalMillis: 60_000,
    }),
  ],
}).getMeter("paperdebugger");

// Core Web Vitals — LCP/INP in ms, CLS is a score (0–1)
const vitalsMs = meter.createHistogram("web_vitals_ms", { unit: "ms" });
const vitalsCls = meter.createHistogram("web_vitals_cls", { unit: "1" });
onLCP((m) => vitalsMs.record(m.value, { vital: "LCP" }));
onINP((m) => vitalsMs.record(m.value, { vital: "INP" }));
onCLS((m) => vitalsCls.record(m.value));

// Error capture — also exported for manual use
export function captureError(error: unknown, attrs?: Record<string, string>) {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.emit({
    severityText: "ERROR",
    body: err.message,
    attributes: {
      "exception.type": err.name,
      "exception.message": err.message,
      "exception.stacktrace": err.stack ?? "",
      ...attrs,
    },
  });
}

window.addEventListener("error", (e) => captureError(e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => captureError(e.reason));

registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      ignoreUrls: [
        /overleaf\.com/,
        /compiles\.overleafusercontent\.com/,
        /google-analytics\.com/,
        /otlp\.xtra\.science/,
      ],
    }),
    new DocumentLoadInstrumentation(),
  ],
});
