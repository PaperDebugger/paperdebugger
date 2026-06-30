import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import { chatStream } from "@/lib/chat-stream";
import { usePaperDebuggerUiStore } from "@/stores/paper-debugger-ui-store";

// Latest user message as plain text. MVP sends only the newest turn — multi-turn
// context (Claude session resume / Codex thread) isn't wired through yet.
function latestUserText(messages: readonly { content: readonly { type: string; text?: string }[] }[]): string {
  const last = messages.at(-1);
  if (!last) return "";
  return last.content.map((p) => (p.type === "text" ? (p.text ?? "") : "")).join("");
}

// Bridges the callback-streamed host into assistant-ui's async-generator adapter.
const hostAdapter: ChatModelAdapter = {
  async *run({ messages }) {
    const provider = usePaperDebuggerUiStore.getState().provider;
    const prompt = latestUserText(messages);

    const chunks: string[] = [];
    let wake: (() => void) | null = null;
    // Boxed so the .then callbacks' assignments survive TS control-flow analysis.
    const ctrl = { finished: false, failure: null as Error | null };
    const bump = () => {
      wake?.();
      wake = null;
    };

    chatStream({ type: "chat", provider, prompt }, (msg) => {
      if (msg.type === "delta") {
        chunks.push(msg.text);
        bump();
      }
    }).then(
      () => {
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
    while (true) {
      if (chunks.length) {
        acc += chunks.splice(0).join("");
        yield { content: [{ type: "text", text: acc }] };
        continue;
      }
      if (ctrl.failure) {
        // Surface host errors (e.g. pd-host not installed) in the thread instead
        // of throwing — keeps the panel usable and avoids an uncaught rejection.
        const note = `⚠️ ${ctrl.failure.message}\n\n(Local host unreachable — see host/README.md to install pd-host.)`;
        yield { content: [{ type: "text", text: acc ? `${acc}\n\n${note}` : note }] };
        return;
      }
      if (ctrl.finished) return;
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  },
};

const UserMessage = () => (
  <MessagePrimitive.Root className="pd-msg pd-msg-user">
    <MessagePrimitive.Parts />
  </MessagePrimitive.Root>
);

const AssistantMessage = () => (
  <MessagePrimitive.Root className="pd-msg pd-msg-assistant">
    <MessagePrimitive.Parts />
  </MessagePrimitive.Root>
);

export function ChatPanel() {
  const runtime = useLocalRuntime(hostAdapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="pd-thread">
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
