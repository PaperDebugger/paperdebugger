import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  type ChatModelAdapter,
} from "@assistant-ui/react";

// ponytail: echo adapter — makes the thread work end-to-end with no backend.
// Swap for the real model transport (lib/intermediate bridge) when chat lands.
const echoAdapter: ChatModelAdapter = {
  async run({ messages }) {
    const last = messages.at(-1);
    const text = last?.content.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";
    return { content: [{ type: "text", text: `Echo: ${text}` }] };
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
  const runtime = useLocalRuntime(echoAdapter);
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
