import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  useAssistantRuntime,
  useMessage,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  MessagePartPrimitive,
  ActionBarPrimitive,
  BranchPickerPrimitive,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import { chatStream, type ChatProvider, type TurnStat } from "@/lib/chat-stream";
import { fetchProjectFiles } from "@/lib/overleaf-sync";
import { usePaperDebuggerUiStore } from "@/stores/paper-debugger-ui-store";
import { useChatStatsStore } from "@/stores/chat-stats-store";
import IconSquarePen from "~icons/lucide/square-pen";
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
// threadId). Module-scoped: one chat panel per page, kept mounted across tab
// switches; resets on page reload.
let continuation: Cont | null = null;

// Bridges the callback-streamed host into assistant-ui's async-generator adapter.
const hostAdapter: ChatModelAdapter = {
  async *run({ messages }) {
    const provider = usePaperDebuggerUiStore.getState().provider;
    const prompt = latestUserText(messages);
    const projectId = overleafProjectId();
    // Resume only if the stored continuation belongs to the current provider.
    const resume = continuation?.provider === provider ? continuation.contId : undefined;

    // Sync the Overleaf project into the host workspace first, so the CLI answers
    // against the current source. Host diffs against disk — only changes are
    // written. Non-fatal: on failure we still answer (just with stale/no files).
    if (projectId) {
      try {
        const files = await fetchProjectFiles(projectId);
        await chatStream({ type: "sync", projectId, files }, () => {});
      } catch (err) {
        console.warn("[PD] project sync failed (continuing)", err);
      }
    }

    const chunks: string[] = [];
    const rchunks: string[] = []; // reasoning/thinking deltas, streamed before the answer
    let wake: (() => void) | null = null;
    // Boxed so the .then callbacks' assignments survive TS control-flow analysis.
    const ctrl = { finished: false, failure: null as Error | null, stat: null as TurnStat | null };
    const bump = () => {
      wake?.();
      wake = null;
    };

    chatStream({ type: "chat", provider, prompt, projectId, resume }, (msg) => {
      if (msg.type === "delta") {
        chunks.push(msg.text);
        bump();
      } else if (msg.type === "reasoning") {
        rchunks.push(msg.text);
        bump();
      } else if (msg.type === "session") {
        continuation = { provider, contId: msg.sessionId };
      }
    }).then(
      (res) => {
        if (res.type === "done" && res.stat) {
          useChatStatsStore.getState().add(res.stat);
          ctrl.stat = res.stat; // also pinned onto this message's metadata (see final yield)
        }
        ctrl.finished = true;
        bump();
      },
      (err) => {
        ctrl.failure = err instanceof Error ? err : new Error(String(err));
        ctrl.finished = true;
        bump();
      },
    );

    let acc = "";
    let racc = "";
    // A reasoning part (if any) renders above the answer via the Reasoning slot.
    const frame = (text: string) => {
      const parts: { type: "reasoning" | "text"; text: string }[] = [];
      if (racc) parts.push({ type: "reasoning", text: racc });
      parts.push({ type: "text", text });
      return { content: parts };
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
        if (ctrl.stat) yield { ...frame(acc), metadata: { custom: { stat: ctrl.stat } } };
        return;
      }
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  },
};

// Icon-only "new conversation": clears the thread and the provider continuation.
function NewChatButton() {
  const runtime = useAssistantRuntime();
  return (
    <button
      className="pd-ctl-btn"
      title="New conversation"
      onClick={() => {
        continuation = null;
        void runtime.threads.switchToNewThread();
      }}
    >
      <IconSquarePen width={16} height={16} />
    </button>
  );
}

const UserMessage = () => (
  <MessagePrimitive.Root className="pd-msg pd-msg-user">
    <MessagePrimitive.Parts />
  </MessagePrimitive.Root>
);

// Text part with an animated typing indicator instead of assistant-ui's default
// trailing " ●". MessagePartPrimitive.InProgress (the built-in) renders its child
// only while the part is still streaming — we just swap the dot for CSS dots.
function TextPart() {
  return (
    <p style={{ whiteSpace: "pre-line", margin: 0 }}>
      <MessagePartPrimitive.Text />
      <MessagePartPrimitive.InProgress>
        <span className="pd-typing" aria-label="Loading">
          <span />
          <span />
          <span />
        </span>
      </MessagePartPrimitive.InProgress>
    </p>
  );
}

// Collapsible "Thinking" block for streamed reasoning/thinking parts.
function ReasoningPart({ text }: { text: string }) {
  if (!text) return null;
  return (
    <details className="pd-reasoning" style={{ margin: "0 0 8px", fontSize: 13, color: "#6b7280" }}>
      <summary style={{ cursor: "pointer", userSelect: "none" }}>Thinking</summary>
      <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{text}</div>
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

// Hover-revealed actions. autohide="always" → the whole bar unmounts unless the
// message is hovered (assistant-ui tracks hover on the message); hideWhenRunning
// keeps it away mid-stream. Copy swaps its icon via MessagePrimitive.If copied.
function AssistantActionBar() {
  return (
    <ActionBarPrimitive.Root className="pd-msg-actions" autohide="always" autohideFloat="always" hideWhenRunning>
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
          <NewChatButton />
        </div>
        <ThreadPrimitive.Viewport className="pd-thread-viewport">
          <ThreadPrimitive.Empty>
            <div className="pd-thread-empty">Ask PaperDebugger anything about your paper.</div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
        </ThreadPrimitive.Viewport>
        <ComposerPrimitive.Root className="pd-composer">
          <ComposerPrimitive.Input className="pd-composer-input" placeholder="Ask PaperDebugger…" rows={1} />
          <ComposerPrimitive.Send className="pd-composer-send" aria-label="Send">
            ↑
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
