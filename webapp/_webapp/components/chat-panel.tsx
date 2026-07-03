import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  useAssistantRuntime,
  useMessage,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
  BranchPickerPrimitive,
  useComposerRuntime,
  unstable_useSlashCommandAdapter,
  type Unstable_SlashCommand,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import { ComposerTriggerPopover } from "./composer-trigger-popover";
import { StreamdownTextPrimitive, type SyntaxHighlighterProps } from "@assistant-ui/react-streamdown";
import { math } from "@streamdown/math";
import { cjk } from "@streamdown/cjk";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import shikiLatex from "@shikijs/langs/latex";
import shikiPython from "@shikijs/langs/python";
import shikiLight from "@shikijs/themes/github-light";
import shikiDark from "@shikijs/themes/github-dark";
import { useState, useEffect, useRef, useMemo } from "react";
import { create } from "zustand";
import { chatStream, type ChatProvider, type TurnStat, type SkillInfo, type ModelInfo } from "@/lib/chat-stream";
import { fetchProjectFiles, fetchProjectZip, batchByBytes } from "@/lib/overleaf-sync";
import { usePaperDebuggerUiStore } from "@/stores/paper-debugger-ui-store";
import { useChatStatsStore } from "@/stores/chat-stats-store";
import IconSquarePen from "~icons/lucide/square-pen";
import IconPuzzle from "~icons/lucide/puzzle";
import IconChevronDown from "~icons/lucide/chevron-down";
import IconHardDriveDownload from "~icons/lucide/hard-drive-download";
import IconCopy from "~icons/lucide/copy";
import IconCheck from "~icons/lucide/check";
import IconRefresh from "~icons/lucide/refresh-cw";
import IconChevronLeft from "~icons/lucide/chevron-left";
import IconChevronRight from "~icons/lucide/chevron-right";
import IconClock from "~icons/lucide/clock";

// Latest user message as plain text. We only send the newest turn — history is
// kept by the provider (Claude session / Codex thread) and resumed via `cont`.
function latestUserText(messages: readonly { content: readonly { type: string; text?: string }[] }[]): string {
  const last = messages.at(-1);
  if (!last) return "";
  return last.content.map((p) => (p.type === "text" ? (p.text ?? "") : "")).join("");
}

// Overleaf project id from the URL (…/project/<id>) → per-project host workspace.
function overleafProjectId(): string | undefined {
  return window.location.pathname.match(/\/project\/([0-9a-fA-F]{24})/)?.[1];
}

// Continuation id for multi-turn: claude sessionId / codex threadId, tagged with
// the provider it belongs to (they aren't interchangeable).
type Cont = { provider: ChatProvider; contId: string };

// Multi-turn continuation for the current conversation (claude sessionId / codex
// threadId). A tiny store so the header can reactively show the id; getState()
// works outside React (in the adapter). One chat panel per page, kept mounted
// across tab switches; resets on page reload.
// convId is the stable telemetry key for one visible conversation — claude
// re-mints its sessionId on every resume, so contId can't group turns. Re-mint
// on "New chat" (set(null)); page reload re-mints naturally.
const useConversationStore = create<{ cont: Cont | null; convId: string; set: (c: Cont | null) => void }>((set) => ({
  cont: null,
  convId: crypto.randomUUID(),
  set: (cont) => set(cont ? { cont } : { cont: null, convId: crypto.randomUUID() }),
}));

// Bridges the callback-streamed host into assistant-ui's async-generator adapter.
const hostAdapter: ChatModelAdapter = {
  async *run({ messages }) {
    const { provider, modelByProvider } = usePaperDebuggerUiStore.getState();
    const model = modelByProvider[provider] || undefined; // empty id → CLI default
    const prompt = latestUserText(messages);
    const projectId = overleafProjectId();
    // Resume only if the stored continuation belongs to the current provider.
    const { cont: stored, convId } = useConversationStore.getState();
    const resume = stored?.provider === provider ? stored.contId : undefined;

    // Sync the Overleaf project into the host workspace first, so the CLI answers
    // against the current source. Host diffs against disk — only changes are
    // written. Non-fatal: on failure we still answer (just with stale/no files).
    const t0 = Date.now(); // user hit send — roots this turn's telemetry trace
    let syncMs: number | undefined;
    if (projectId) {
      try {
        const files = await fetchProjectFiles(projectId);
        await chatStream({ type: "sync", projectId, files }, () => {});
      } catch (err) {
        console.warn("[PD] project sync failed (continuing)", err);
      } finally {
        // Measured even on failure, so a failed sync's delay isn't misattributed
        // to the bridge span in the turn's trace.
        syncMs = Date.now() - t0;
      }
    }

    const chunks: string[] = [];
    const rchunks: string[] = []; // reasoning/thinking deltas, streamed before the answer
    let wake: (() => void) | null = null;
    // Boxed so the .then callbacks' assignments survive TS control-flow analysis.
    const ctrl = { finished: false, failure: null as Error | null, stat: null as TurnStat | null };
    // Thinking duration: first reasoning delta → first answer delta (or turn end).
    // Undefined while still thinking — ReasoningPart keys its label off this.
    const think = { start: null as number | null, ms: undefined as number | undefined };
    const bump = () => {
      wake?.();
      wake = null;
    };

    chatStream({ type: "chat", provider, model, prompt, projectId, resume, t0, syncMs, convId }, (msg) => {
      if (msg.type === "delta") {
        if (think.start != null && think.ms == null) think.ms = Date.now() - think.start;
        chunks.push(msg.text);
        bump();
      } else if (msg.type === "reasoning") {
        think.start ??= Date.now();
        rchunks.push(msg.text);
        bump();
      } else if (msg.type === "session") {
        // Drop stale session ids: if "New chat" re-minted convId while this turn
        // was in flight, pairing the new conversation with this turn's
        // continuation would resume the old thread next turn.
        const store = useConversationStore.getState();
        if (store.convId === convId) store.set({ provider, contId: msg.sessionId });
      }
    }).then(
      (res) => {
        if (res.type === "done" && res.stat) {
          useChatStatsStore.getState().add(res.stat);
          ctrl.stat = res.stat; // also pinned onto this message's metadata (see final yield)
        }
        if (think.start != null && think.ms == null) think.ms = Date.now() - think.start;
        ctrl.finished = true;
        bump();
      },
      (err) => {
        ctrl.failure = err instanceof Error ? err : new Error(String(err));
        if (think.start != null && think.ms == null) think.ms = Date.now() - think.start;
        ctrl.finished = true;
        bump();
      },
    );

    let acc = "";
    let racc = "";
    // A reasoning part (if any) renders above the answer via the Reasoning slot.
    // Each frame re-pins metadata.custom (the runtime takes the last yield's), so
    // thinkMs rides along on every frame once measured.
    const frame = (text: string) => {
      const parts: { type: "reasoning" | "text"; text: string }[] = [];
      if (racc) parts.push({ type: "reasoning", text: racc });
      parts.push({ type: "text", text });
      return { content: parts, metadata: { custom: { thinkMs: think.ms } } };
    };
    while (true) {
      if (chunks.length || rchunks.length) {
        acc += chunks.splice(0).join("");
        racc += rchunks.splice(0).join("");
        yield frame(acc);
        continue;
      }
      if (ctrl.failure) {
        // Surface host errors (e.g. pd-host not installed) in the thread instead
        // of throwing — keeps the panel usable and avoids an uncaught rejection.
        const note = `⚠️ ${ctrl.failure.message}\n\n(Local host unreachable — see host/README.md to install pd-host.)`;
        yield frame(acc ? `${acc}\n\n${note}` : note);
        return;
      }
      if (ctrl.finished) {
        // Final frame carries the per-turn timing on message metadata, so a hover
        // popover can read it back from the message itself (see MessageStats).
        if (ctrl.stat) yield { ...frame(acc), metadata: { custom: { stat: ctrl.stat, thinkMs: think.ms } } };
        return;
      }
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  },
};

// Live pd-host connectivity dot. Pings the host on mount and every 30s (the
// native port is shared/long-lived, so a ping reuses the existing process — it
// only spawns pd-host the first time). Green = reachable, red = not, pulsing =
// checking.
const CONN_PING_MS = 30_000;
function ConnectionIndicator() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        await chatStream({ type: "ping" }, () => {});
        if (alive) setStatus("online");
      } catch {
        if (alive) setStatus("offline");
      }
    };
    void check();
    const t = setInterval(() => void check(), CONN_PING_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  const label =
    status === "online"
      ? "pd-host connected"
      : status === "offline"
        ? "pd-host not reachable — install it (see host/README.md)"
        : "Checking pd-host…";
  return <span className={`pd-conn pd-conn-${status}`} title={label} aria-label={label} role="status" />;
}

// Skills installed for a provider's CLI, cached module-wide and shared between the
// header button and the composer slash menu (one fetch per provider, deduped).
const skillsCache = new Map<ChatProvider, SkillInfo[]>();
const skillsInflight = new Map<ChatProvider, Promise<SkillInfo[]>>();
function fetchSkills(provider: ChatProvider): Promise<SkillInfo[]> {
  const cached = skillsCache.get(provider);
  if (cached) return Promise.resolve(cached);
  let p = skillsInflight.get(provider);
  if (!p) {
    p = chatStream({ type: "skills", provider }, () => {})
      .then((res) => (res.type === "skills" ? res.skills : []))
      .catch(() => [] as SkillInfo[])
      .then((list) => {
        skillsCache.set(provider, list);
        skillsInflight.delete(provider);
        return list;
      });
    skillsInflight.set(provider, p);
  }
  return p;
}
// `enabled` gates the fetch (the button only wants it while open). null = loading.
function useSkills(provider: ChatProvider, enabled: boolean): SkillInfo[] | null {
  const [skills, setSkills] = useState<SkillInfo[] | null>(() => skillsCache.get(provider) ?? null);
  useEffect(() => {
    if (!enabled) return;
    const hit = skillsCache.get(provider);
    if (hit) {
      setSkills(hit);
      return;
    }
    let alive = true;
    setSkills(null);
    void fetchSkills(provider).then((list) => alive && setSkills(list));
    return () => {
      alive = false;
    };
  }, [provider, enabled]);
  return skills;
}

// Available models per provider, cached module-wide (mirrors the skills cache).
const modelsCache = new Map<ChatProvider, ModelInfo[]>();
const modelsInflight = new Map<ChatProvider, Promise<ModelInfo[]>>();
function fetchModels(provider: ChatProvider): Promise<ModelInfo[]> {
  const cached = modelsCache.get(provider);
  if (cached) return Promise.resolve(cached);
  let p = modelsInflight.get(provider);
  if (!p) {
    p = chatStream({ type: "models", provider }, () => {})
      .then((res) => (res.type === "models" ? res.models : []))
      .catch(() => [] as ModelInfo[])
      .then((list) => {
        modelsCache.set(provider, list);
        modelsInflight.delete(provider);
        return list;
      });
    modelsInflight.set(provider, p);
  }
  return p;
}
function useModels(provider: ChatProvider): ModelInfo[] | null {
  const [models, setModels] = useState<ModelInfo[] | null>(() => modelsCache.get(provider) ?? null);
  useEffect(() => {
    const hit = modelsCache.get(provider);
    if (hit) {
      setModels(hit);
      return;
    }
    let alive = true;
    setModels(null);
    void fetchModels(provider).then((list) => alive && setModels(list));
    return () => {
      alive = false;
    };
  }, [provider]);
  return models;
}

// Model picker for the current provider. Models come from the host (Claude tier
// aliases that auto-track the latest release; Codex config default + curated),
// so new models need no extension update. Selection persists per provider.
function ModelSelector() {
  const provider = usePaperDebuggerUiStore((s) => s.provider);
  const selectedId = usePaperDebuggerUiStore((s) => s.modelByProvider[provider] ?? "");
  const update = usePaperDebuggerUiStore((s) => s.update);
  const [open, setOpen] = useState(false);
  const models = useModels(provider);
  const current = models?.find((m) => m.id === selectedId) ?? models?.[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest?.(".pd-model-wrap")) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (id: string) => {
    const prev = usePaperDebuggerUiStore.getState().modelByProvider;
    update({ modelByProvider: { ...prev, [provider]: id } });
    setOpen(false);
  };

  return (
    <div className="pd-model-wrap">
      <button className="pd-model-btn" title="Model" onClick={() => setOpen((o) => !o)}>
        {current?.name ?? "Model"}
        <IconChevronDown className="pd-model-caret" width={13} height={13} />
      </button>
      {open && (
        <div className="pd-model-pop">
          {(models ?? []).map((m) => (
            <button
              key={m.id || "default"}
              className={`pd-model-item${m.id === selectedId ? " is-selected" : ""}`}
              onClick={() => pick(m.id)}
            >
              {m.name}
              {m.id === selectedId && <IconCheck width={13} height={13} />}
            </button>
          ))}
          {!models && <div className="pd-model-empty">Detecting…</div>}
        </div>
      )}
    </div>
  );
}

// Composer slash menu: typing "/" lists the provider's installed skills;
// selecting one inserts "/<skill> " so the CLI resolves it. Built on
// assistant-ui's trigger-popover primitives (see ComposerTriggerPopover).
function SlashSkills() {
  const provider = usePaperDebuggerUiStore((s) => s.provider);
  const skills = useSkills(provider, true); // eager so the first "/" is instant
  const composer = useComposerRuntime();
  const commands = useMemo<Unstable_SlashCommand[]>(
    () =>
      (skills ?? []).map((s) => ({
        id: s.name,
        label: s.name,
        description: s.description,
        execute: () => composer.setText(`/${s.name} `),
      })),
    [skills, composer],
  );
  const slash = unstable_useSlashCommandAdapter({ commands, removeOnExecute: true });
  return <ComposerTriggerPopover char="/" {...slash} fallbackIcon={IconPuzzle} />;
}

// Current conversation id in the header: codex threadId / claude sessionId.
// Truncated with the full id in the tooltip; hidden until a turn establishes one.
function ConversationId() {
  const cont = useConversationStore((s) => s.cont);
  if (!cont) return null;
  const kind = cont.provider === "codex" ? "thread" : "session";
  const shortId = cont.contId.length > 8 ? `${cont.contId.slice(0, 8)}…` : cont.contId;
  return (
    <span className="pd-conv-id" title={`${kind}: ${cont.contId}`}>
      {kind} {shortId}
    </span>
  );
}

// Icon-only "new conversation": clears the thread and the provider continuation.
function NewChatButton() {
  const runtime = useAssistantRuntime();
  return (
    <button
      className="pd-ctl-btn"
      title="New conversation"
      onClick={() => {
        useConversationStore.getState().set(null);
        void runtime.threads.switchToNewThread();
      }}
    >
      <IconSquarePen width={16} height={16} />
    </button>
  );
}

// Per-native-message payload cap for the batched full sync. Keeps each frame well
// under the pipe's limit so a big project can't hang the host with one giant msg.
const SYNC_BATCH_BYTES = 512 * 1024;

// Manual full sync: download the whole project (incl. images) via zip and mirror
// it into the host workspace in size-capped batches. Complete + socket-independent
// — the reliable fallback to the automatic incremental sync. Shows download then
// per-batch upload progress.
function SyncButton() {
  const [state, setState] = useState<{ phase: "idle" | "download" | "upload"; ratio: number | null }>({
    phase: "idle",
    ratio: null,
  });
  const projectId = overleafProjectId();
  const busy = state.phase !== "idle";

  const run = async () => {
    if (!projectId || busy) return;
    setState({ phase: "download", ratio: null });
    try {
      const files = await fetchProjectZip(projectId, ({ received, total }) =>
        setState({ phase: "download", ratio: total ? received / total : null }),
      );
      const batches = batchByBytes(files, SYNC_BATCH_BYTES);
      const manifest = files.map((f) => f.path);
      for (let i = 0; i < batches.length; i++) {
        setState({ phase: "upload", ratio: batches.length ? i / batches.length : 1 });
        // The final batch carries the full manifest so the host prunes orphans.
        const prune = i === batches.length - 1 ? manifest : undefined;
        await chatStream({ type: "sync", projectId, files: batches[i], prune }, () => {});
      }
    } catch (err) {
      console.warn("[PD] manual project sync failed", err);
    } finally {
      setState({ phase: "idle", ratio: null });
    }
  };

  const pct = state.ratio == null ? null : Math.round(state.ratio * 100);
  const title = !projectId
    ? "Open a project to sync"
    : state.phase === "download"
      ? `Downloading project… ${pct == null ? "" : pct + "%"}`
      : state.phase === "upload"
        ? `Syncing to local… ${pct ?? 0}%`
        : "Sync full project to local";

  return (
    <button className="pd-ctl-btn" title={title} disabled={busy || !projectId} onClick={run}>
      {busy && (
        <span className={`pd-progress${pct == null ? " pd-progress-indeterminate" : ""}`}>
          <span className="pd-progress-fill" style={pct == null ? undefined : { width: `${pct}%` }} />
        </span>
      )}
      <IconHardDriveDownload width={16} height={16} />
    </button>
  );
}

const UserMessage = () => (
  <MessagePrimitive.Root className="pd-msg pd-msg-user">
    <MessagePrimitive.Parts />
  </MessagePrimitive.Root>
);

// Text part: rendered by Streamdown (@assistant-ui/react-streamdown) — built-in
// Shiki highlighting, KaTeX math, Mermaid, incomplete-markdown repair, and a
// "block" streaming caret that shows while generating (covers the pre-first-
// token wait too). GFM is on by default; no hand-rolled loading/caret needed.
// Fine-grained Shiki: only latex + python grammars, two themes, and the pure-JS
// regex engine (no wasm). Avoids @streamdown/code, which bundles Shiki's full
// ~200-language set (~10MB). Created once, on the first code block.
let highlighterPromise: Promise<HighlighterCore> | null = null;
const getHighlighter = () =>
  (highlighterPromise ??= createHighlighterCore({
    themes: [shikiLight, shikiDark],
    langs: [shikiLatex, shikiPython],
    engine: createJavaScriptRegexEngine(),
  }));
const SHIKI_LANG: Record<string, string> = { latex: "latex", tex: "latex", python: "python", py: "python" };

// Streamdown code-block renderer. For latex/python we async-highlight with the
// fine-grained highlighter and inject Shiki's dual-theme HTML; any other language
// (or before the highlighter loads) falls back to plain <pre><code>.
function CodeHighlighter({ code, language, components }: SyntaxHighlighterProps) {
  const [html, setHtml] = useState<string | null>(null);
  const lang = SHIKI_LANG[language];
  useEffect(() => {
    if (!lang) return;
    let alive = true;
    getHighlighter()
      .then((hl) => {
        const out = hl.codeToHtml(code, { lang, themes: { light: "github-light", dark: "github-dark" } });
        if (alive) setHtml(out);
      })
      .catch(() => alive && setHtml(null));
    return () => {
      alive = false;
    };
  }, [code, lang]);
  const { Pre, Code } = components;
  if (!lang || html == null) {
    return (
      <Pre>
        <Code className={`language-${language}`}>{code}</Code>
      </Pre>
    );
  }
  return <div className="pd-shiki" dangerouslySetInnerHTML={{ __html: html }} />;
}

// Text part rendered by Streamdown: KaTeX math + CJK, incomplete-markdown repair,
// and a "block" streaming caret. Code blocks go through our latex/python-only
// highlighter (see CodeHighlighter) instead of the full-Shiki `code` plugin.
function TextPart() {
  return (
    <StreamdownTextPrimitive
      plugins={{ math, cjk }}
      componentsByLanguage={{
        latex: { SyntaxHighlighter: CodeHighlighter },
        tex: { SyntaxHighlighter: CodeHighlighter },
        python: { SyntaxHighlighter: CodeHighlighter },
        py: { SyntaxHighlighter: CodeHighlighter },
      }}
      caret="block"
    />
  );
}

// Collapsible block for streamed reasoning/thinking parts. Pulses "Thinking…"
// while deltas stream, settles to "Thought for Xs" once the answer starts
// (thinkMs is measured by the adapter and pinned on message metadata).
function ReasoningPart({ text }: { text: string }) {
  const thinkMs = useMessage((m) => (m.metadata.custom as { thinkMs?: number }).thinkMs);
  if (!text) return null;
  return (
    <details className="pd-reasoning">
      <summary className={thinkMs == null ? "pd-reasoning-live" : undefined}>
        <IconChevronRight className="pd-reasoning-chevron" width={12} height={12} />
        {thinkMs == null ? "Thinking…" : `Thought for ${fmtMs(thinkMs)}`}
      </summary>
      <div className="pd-reasoning-body">{text}</div>
    </details>
  );
}

const fmtMs = (ms?: number) => (ms == null ? "–" : `${(ms / 1000).toFixed(1)}s`);

// Per-turn timing pinned on the message metadata by the adapter. Shows a compact
// TTFT/total chip; hovering it reveals the core breakdown in a pure-CSS popover.
function MessageStats() {
  const stat = useMessage((m) => m.metadata.custom.stat as TurnStat | undefined);
  if (!stat) return null;
  const ph = (name: string) => stat.phases.find((p) => p.name === name)?.ms;
  const rows: [string, number | undefined][] = [
    ["TTFT", stat.ttftMs],
    ["total", stat.totalMs],
    ["hooks", ph("hooks")],
    ["mcp", ph("mcp")],
    ["pre-answer", ph("pre-answer")],
  ];
  return (
    <span className="pd-stats">
      <IconClock width={12} height={12} />
      <span className="pd-stats-chip">
        {fmtMs(stat.ttftMs)} / {fmtMs(stat.totalMs)}
      </span>
      <span className="pd-stats-pop" role="tooltip">
        {rows.map(([k, v]) => (
          <span key={k} className="pd-stats-row">
            <span className="pd-stats-k">{k}</span>
            <span>{fmtMs(v)}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

// Wall-clock time the message was created (local runtime stamps every message).
function MessageTime() {
  const createdAt = useMessage((m) => m.createdAt);
  if (!createdAt) return null;
  return <span className="pd-msg-time">{createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>;
}

// Actions always rendered in-flow so they reserve their row inside the message
// bubble (no layout shift); CSS reveals them on hover and hides them otherwise
// (autohide="never" keeps the primitive mounted). Copy swaps icon via If copied.
function AssistantActionBar() {
  return (
    <ActionBarPrimitive.Root className="pd-msg-actions" autohide="never">
      <ActionBarPrimitive.Copy className="pd-icon-btn" title="Copy">
        <MessagePrimitive.If copied={false}>
          <IconCopy width={14} height={14} />
        </MessagePrimitive.If>
        <MessagePrimitive.If copied>
          <IconCheck width={14} height={14} />
        </MessagePrimitive.If>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload className="pd-icon-btn" title="Regenerate">
        <IconRefresh width={14} height={14} />
      </ActionBarPrimitive.Reload>
      <MessageStats />
      <MessageTime />
    </ActionBarPrimitive.Root>
  );
}

// Branch switcher (‹ 1/2 ›), shown only once a message has alternates — i.e. after
// a regenerate. Stays visible (not autohidden) so the count is always readable.
function MessageBranchPicker() {
  return (
    <MessagePrimitive.If hasBranches>
      <BranchPickerPrimitive.Root className="pd-branch">
        <BranchPickerPrimitive.Previous className="pd-icon-btn" title="Previous">
          <IconChevronLeft width={14} height={14} />
        </BranchPickerPrimitive.Previous>
        <span>
          <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
        </span>
        <BranchPickerPrimitive.Next className="pd-icon-btn" title="Next">
          <IconChevronRight width={14} height={14} />
        </BranchPickerPrimitive.Next>
      </BranchPickerPrimitive.Root>
    </MessagePrimitive.If>
  );
}

const AssistantMessage = () => (
  <MessagePrimitive.Root className="pd-msg pd-msg-assistant">
    <MessagePrimitive.Parts components={{ Text: TextPart, Reasoning: ReasoningPart }} />
    <MessageBranchPicker />
    <AssistantActionBar />
  </MessagePrimitive.Root>
);

export function ChatPanel() {
  const runtime = useLocalRuntime(hostAdapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="pd-thread">
        <div className="pd-chat-header">
          <ConnectionIndicator />
          <ModelSelector />
          <ConversationId />
          <span className="pd-header-spacer" />
          <SyncButton />
          <NewChatButton />
        </div>
        <ThreadPrimitive.Viewport className="pd-thread-viewport">
          <ThreadPrimitive.Empty>
            <div className="pd-thread-empty">Ask PaperDebugger anything about your paper.</div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
        </ThreadPrimitive.Viewport>
        <ComposerPrimitive.Unstable_TriggerPopoverRoot>
          <ComposerPrimitive.Root className="pd-composer">
            <ComposerPrimitive.Input
              className="pd-composer-input"
              placeholder="Ask PaperDebugger…  (type / for skills)"
              rows={1}
            />
            <ComposerPrimitive.Send className="pd-composer-send" aria-label="Send">
              ↑
            </ComposerPrimitive.Send>
            <SlashSkills />
          </ComposerPrimitive.Root>
        </ComposerPrimitive.Unstable_TriggerPopoverRoot>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
