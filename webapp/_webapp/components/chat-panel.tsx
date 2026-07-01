import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  useAssistantRuntime,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import { chatStream, type ChatProvider } from "@/lib/chat-stream";
import { fetchProjectFiles } from "@/lib/overleaf-sync";
import { usePaperDebuggerUiStore } from "@/stores/paper-debugger-ui-store";
import { useChatStatsStore } from "@/stores/chat-stats-store";
import IconSquarePen from "~icons/lucide/square-pen";

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
    const ctrl = { finished: false, failure: null as Error | null };
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
        if (res.type === "done" && res.stat) useChatStatsStore.getState().add(res.stat);
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
      if (ctrl.finished) return;
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

const AssistantMessage = () => (
  <MessagePrimitive.Root className="pd-msg pd-msg-assistant">
    <MessagePrimitive.Parts components={{ Reasoning: ReasoningPart }} />
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
