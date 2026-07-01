# pd-host — PaperDebugger local host

A tiny Node native-messaging host that bridges the PaperDebugger browser
extension to your local **Claude Code** and **Codex** CLIs. Your prompts go to
the CLI running on your machine (reusing its existing login); replies stream
back to the chat panel. Nothing but the extension talks to it.

```
extension (background SW)  ⇄  chrome native messaging  ⇄  pd-host (native.mjs)  ⇄  claude / codex CLI
```

## Requirements

- `bun` (or Node 20+) on your `PATH`.
- A working `claude` CLI (Claude Code) and/or `codex` CLI, already logged in.

## Setup

The host is TypeScript. With **bun** it runs the `.ts` directly — no build step.

1. **Register the host** (one line, from `webapp/_webapp`):

   ```sh
   bun host/src/install.ts
   ```

   This auto-installs the host's deps if needed, writes a launcher that runs the
   host via bun's absolute path, and installs the native-messaging manifest into
   every detected Chromium browser **plus the WXT dev profile** (`.wxt/chrome-data`).

   No extension id needed — `wxt.config.ts` pins a manifest `key`, so the
   extension always loads as `dfkedikhakpapbfcnbpmfhpklndgiaog` and the installer
   defaults to it. (Pass an id, or `--browser=<name>`, to narrow it.)

2. **Load / reload the extension** at `chrome://extensions` (Developer mode →
   Load unpacked → `.output/chrome-mv3`).
3. Open the chat panel → **Settings → Local host → Test connection** → ✓.

> **Node instead of bun?** `cd host && npm install && npm run build`, then
> `node dist/install.js` — the launcher then runs the compiled `dist/native.js`.
> `npm run check` (or `bun run check`) type-checks via `tsc --noEmit`.

### Why a manual step at all?

A browser extension is sandboxed — it can't run local programs or write the
manifest itself (that's the security boundary native messaging exists to
enforce). So a one-time local command registers the host. It only re-runs if the
host path or extension id changes.

## Protocol (extension ↔ host)

4-byte little-endian length + UTF-8 JSON frames (Chrome native messaging):

| → request                                                 | ← response (streamed)                                                                           |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `{ id, type: "ping" }`                                    | `{ id, type: "pong" }`                                                                          |
| `{ id, type: "chat", provider, prompt, model?, resume? }` | `{ id, type: "delta", text }` … then `{ id, type: "done" }` or `{ id, type: "error", message }` |

`provider` is `"claude"` or `"codex"`.

## Limits (MVP)

- Chat streaming only — no inline edit/patch cards, attachments, or skills yet.
- Each turn sends only the latest user message (no multi-turn context wired
  through; Claude session id / Codex thread id are surfaced but not yet reused).
- Claude tool calls run with `bypassPermissions` (no approval UI). Codex runs
  `sandbox: read-only`.
