export const HANDLER_NAMES = {
  GET_COOKIES: "getCookies",
  GET_URL: "getUrl",
  GET_OR_CREATE_SESSION_ID: "getOrCreateSessionId",
  FETCH_IMAGE: "fetchImage",
  REQUEST_HOST_PERMISSION: "requestHostPermission",
} as const;

// Native-messaging host that bridges to the local Claude Code / Codex CLI.
// Must match host/install.mjs and the installed manifest.
export const NATIVE_HOST_NAME = "com.paperdebugger.host";

// Long-lived runtime port name for streamed chat (background ⇄ content script).
export const CHAT_STREAM_PORT = "pd-chat-stream";
