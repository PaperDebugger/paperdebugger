export function logInfo(...data: unknown[]) {
  // eslint-disable-next-line no-console
  console.log("[PaperDebugger]", ...data);
}

export function logWarn(...data: unknown[]) {
  console.warn("[PaperDebugger]", ...data);
}

export function logError(...data: unknown[]) {
  console.error("[PaperDebugger]", ...data);
}

export function logDebug(...data: unknown[]) {
  // eslint-disable-next-line no-console
  console.debug("[PaperDebugger]", ...data);
}
