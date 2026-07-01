import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { workspaceDir } from "../workspace.js";
import type { ChatRequest, OnDelta } from "../types.js";

// Minimal wrapper around `codex app-server` (JSON-RPC over newline-delimited
// stdio). Trimmed port of ageaf/host/src/runtimes/codex/appServer.ts — no MCP,
// no env scrubbing, no approval handling (we run sandboxed read-only).
type JsonRpcId = number | string;

interface JsonRpcMessage {
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message?: string } | unknown;
}

interface Pending {
  resolve: (value: JsonRpcMessage) => void;
  reject: (error: Error) => void;
}

class CodexAppServer {
  private child: ChildProcess | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly listeners = new Set<(m: JsonRpcMessage) => void>();
  private started = false;
  private initialized = false;

  constructor(private readonly cwd: string) {}

  subscribe(listener: (m: JsonRpcMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const child = spawn("codex", ["app-server"], { cwd: this.cwd, stdio: ["pipe", "pipe", "pipe"] });
    this.child = child;

    const fail = (err: Error) => {
      this.child = null;
      this.started = false;
      this.initialized = false;
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
    };
    child.on("error", fail);
    child.on("exit", () => fail(new Error("codex app-server exited")));

    await new Promise<void>((resolve, reject) => {
      child.once("spawn", () => resolve());
      child.once("error", reject);
    });

    if (child.stdout) {
      createInterface({ input: child.stdout }).on("line", (line) => this.onLine(line));
    }
    if (child.stderr) {
      // codex writes diagnostics to stderr; surface them for debugging.
      createInterface({ input: child.stderr }).on("line", (line) => {
        if (line.trim()) console.error("[codex]", line.trim().slice(0, 300));
      });
    }
  }

  private onLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    let m: JsonRpcMessage;
    try {
      m = JSON.parse(trimmed) as JsonRpcMessage;
    } catch {
      return;
    }
    const id = typeof m.id === "number" ? m.id : null;
    if (id != null && (Object.hasOwn(m, "result") || Object.hasOwn(m, "error"))) {
      const p = this.pending.get(id);
      if (p) {
        this.pending.delete(id);
        p.resolve(m);
      }
      return;
    }
    if (typeof m.method === "string") {
      for (const l of this.listeners) l(m);
    }
  }

  async ensureInitialized(): Promise<void> {
    await this.start();
    if (this.initialized) return;
    const res = await this.request("initialize", {
      clientInfo: { name: "paperdebugger", title: "PaperDebugger", version: "0.0.0" },
    });
    if (res.error) throw new Error(this.errorText(res.error, "codex initialize failed"));
    this.notify("initialized");
    this.initialized = true;
  }

  request(method: string, params: Record<string, unknown>, opts: { timeoutMs?: number } = {}): Promise<JsonRpcMessage> {
    const child = this.child;
    if (!child?.stdin) return Promise.reject(new Error("codex app-server is not running"));
    const id = this.nextId++;
    child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    const timeoutMs = opts.timeoutMs ?? 60000;
    return new Promise<JsonRpcMessage>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      if (timeoutMs > 0) {
        setTimeout(() => {
          if (this.pending.delete(id)) reject(new Error(`codex ${method} timed out`));
        }, timeoutMs);
      }
    });
  }

  notify(method: string, params?: Record<string, unknown>): void {
    const child = this.child;
    if (!child?.stdin) return;
    child.stdin.write(`${JSON.stringify(params === undefined ? { method } : { method, params })}\n`);
  }

  private errorText(error: unknown, fallback: string): string {
    if (error && typeof error === "object" && "message" in error) {
      const m = (error as { message?: unknown }).message;
      if (typeof m === "string") return m;
    }
    return fallback;
  }
}

// One app-server per workspace cwd (per project), reused across turns.
const servers = new Map<string, CodexAppServer>();
async function getServer(cwd: string): Promise<CodexAppServer> {
  let server = servers.get(cwd);
  if (!server) {
    server = new CodexAppServer(cwd);
    servers.set(cwd, server);
  }
  await server.ensureInitialized();
  return server;
}

function extractThreadId(res: JsonRpcMessage): string | null {
  const r = (res.result ?? {}) as { threadId?: unknown; thread_id?: unknown; thread?: { id?: unknown } };
  const id = r.threadId ?? r.thread_id ?? r.thread?.id;
  return typeof id === "string" && id ? id : null;
}

function deltaText(params: Record<string, unknown> | undefined): string {
  const v = params?.delta ?? params?.text ?? params?.content;
  return typeof v === "string" ? v : "";
}

// Resume the given thread if possible, else start a fresh one. Returns the
// live threadId (may differ from the requested one if resume failed).
async function ensureThread(server: CodexAppServer, cwd: string, msg: ChatRequest): Promise<string> {
  const startParams = {
    model: msg.model ?? null,
    modelProvider: null,
    cwd,
    approvalPolicy: "never",
    sandbox: "read-only",
    config: null,
    baseInstructions: null,
    developerInstructions: null,
    experimentalRawEvents: false,
  };

  const resume = msg.resume?.trim();
  if (resume) {
    try {
      const r = await server.request(
        "thread/resume",
        { threadId: resume, history: null, path: null, ...startParams },
        { timeoutMs: 30000 },
      );
      if (!r.error) return extractThreadId(r) ?? resume;
    } catch {
      // fall through to a fresh thread
    }
  }

  const s = await server.request("thread/start", startParams, { timeoutMs: 30000 });
  const id = extractThreadId(s);
  if (!id) throw new Error("codex: failed to start thread");
  return id;
}

// Run one chat turn through Codex. onDelta(text) per streamed chunk; returns the
// threadId so the caller can resume this conversation next turn.
export async function runCodex(msg: ChatRequest, onDelta: OnDelta): Promise<string> {
  const cwd = workspaceDir(msg.projectId);
  const server = await getServer(cwd);
  const threadId = await ensureThread(server, cwd, msg);

  const done = new Promise<void>((resolve, reject) => {
    const unsub = server.subscribe((m) => {
      switch (m.method) {
        case "item/agentMessage/delta": {
          const text = deltaText(m.params);
          if (text) onDelta(text);
          break;
        }
        case "turn/completed":
          unsub();
          resolve();
          break;
        case "turn/error":
        case "error": {
          unsub();
          const message = typeof m.params?.message === "string" ? m.params.message : "codex turn error";
          reject(new Error(message));
          break;
        }
      }
    });
  });

  await server.request(
    "turn/start",
    {
      threadId,
      input: [{ type: "text", text: String(msg.prompt ?? "") }],
      cwd,
      approvalPolicy: "never",
      sandboxPolicy: { type: "readOnly" },
      model: msg.model ?? null,
      summary: null,
      outputSchema: null,
      collaborationMode: null,
    },
    { timeoutMs: 30000 },
  );

  await done;
  return threadId;
}
