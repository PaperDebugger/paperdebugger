import { fromJson } from "@/libs/protobuf-utils";
import { useConversationStore } from "@/stores/conversation/conversation-store";
import { useSelectionStore } from "@/stores/selection-store";
import { InternalMessage, useStreamingStateMachine } from "@/stores/streaming";
import {
  createAssistantMessage,
  createToolCallMessage,
  createToolCallPrepareMessage,
  createUserMessage,
} from "@/types/message";
import { isEmptyConversation } from "@/views/chat/helper";
import { MessageSchema } from "@gen/apiclient/chat/v2/chat_pb";
import { Button, Input } from "@heroui/react";
import { useState } from "react";

// --- Utility functions ---
const loremIpsum =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
const randomText = () =>
  loremIpsum
    .split(" ")
    .slice(0, Math.floor(Math.random() * loremIpsum.split(" ").length) + 1)
    .join(" ") + ".";
const randomUUID = () => {
  const alpha = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) result += alpha[Math.floor(Math.random() * alpha.length)];
  return result;
};

// --- DevTools main component ---
export const DevTools = () => {
  // State management
  const { selectedText, setSelectedText, setSelectionRange } = useSelectionStore();
  const streamingMessage = useStreamingStateMachine((s) => s.streamingMessage);
  const { startFromScratch, currentConversation, setCurrentConversation } = useConversationStore();
  const [preparingDelay, setPreparingDelay] = useState(2);

  // Helper functions to update streaming message
  const setStreamingMessage = (message: typeof streamingMessage) => {
    useStreamingStateMachine.setState({ streamingMessage: message });
  };
  const updateStreamingMessage = (updater: (prev: typeof streamingMessage) => typeof streamingMessage) => {
    useStreamingStateMachine.setState((state) => ({
      streamingMessage: updater(state.streamingMessage),
    }));
  };

  // --- Event handlers ---
  // Conversation related
  const handleClearConversation = () => setCurrentConversation({ ...currentConversation, messages: [] });
  const handleAddUserMessage = () =>
    setCurrentConversation({
      ...currentConversation,
      messages: [
        ...currentConversation.messages,
        fromJson(MessageSchema, {
          messageId: randomUUID(),
          payload: { user: { content: "User, " + randomText(), selectedText: selectedText } },
        }),
      ],
    });
  const handleAddAssistantMessage = () =>
    setCurrentConversation({
      ...currentConversation,
      messages: [
        ...currentConversation.messages,
        fromJson(MessageSchema, {
          messageId: "1",
          payload: { assistant: { content: randomText() } },
        }),
      ],
    });
  const handleAddToolCallMessage = (type: "greeting" | "paper_score") =>
    setCurrentConversation({
      ...currentConversation,
      messages: [
        ...currentConversation.messages,
        fromJson(MessageSchema, {
          messageId: randomUUID(),
          payload:
            type === "greeting"
              ? { toolCall: { name: "greeting", args: JSON.stringify({ name: "Junyi" }), result: "Hello, Junyi!" } }
              : {
                  toolCall: {
                    name: "paper_score",
                    args: JSON.stringify({ paper_id: "123" }),
                    result: '<RESULT>{ "percentile": 0.74829 }</RESULT><INSTRUCTION>123</INSTRUCTION>',
                  },
                },
        }),
      ],
    });
  const handleStaleLastConversationMessage = () => {
    const newMessages = currentConversation.messages.map((msg, _, arr) =>
      msg.messageId === arr[arr.length - 1]?.messageId ? { ...msg, status: "stale" } : msg,
    );
    setCurrentConversation({ ...currentConversation, messages: newMessages });
  };

  // SelectedText related
  const handleClearSelectedText = () => {
    setSelectedText(null);
    setSelectionRange(null);
  };
  const handleSelectedTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedText(e.target.value);
    setSelectionRange(new Range());
  };

  // StreamingMessage related
  const handleClearStreamingMessage = () => setStreamingMessage({ ...streamingMessage, parts: [] });
  const handleStaleLastStreamingMessage = () => {
    const newParts = useStreamingStateMachine
      .getState()
      .streamingMessage.parts.map((part, _, arr) =>
        part.id === arr[arr.length - 1]?.id ? { ...part, status: "stale" as const } : part,
      );
    setStreamingMessage({ ...streamingMessage, parts: [...newParts] });
  };
  // Generic delay handler
  const withDelay = (fn: () => void) => {
    if (preparingDelay > 0) setTimeout(fn, preparingDelay * 1000);
    else fn();
  };
  // StreamingMessage add various message types
  const handleAddStreamingUserMessage = () => {
    const newMessage = createUserMessage(randomUUID(), "User Message Preparing", {
      selectedText: selectedText ?? "",
      status: "streaming",
    });
    setStreamingMessage({ ...streamingMessage, parts: [...streamingMessage.parts, newMessage] });
    withDelay(() => {
      const newParts = useStreamingStateMachine.getState().streamingMessage.parts.map((part) =>
        part.id === newMessage.id
          ? {
              ...part,
              data: { ...part.data, content: "User Message Prepared" },
              status: part.status === "streaming" ? ("complete" as const) : part.status,
            }
          : part,
      ) as InternalMessage[];
      setStreamingMessage({ ...streamingMessage, parts: [...newParts] });
    });
  };
  const handleAddStreamingToolPrepare = () => {
    const newMessage = createToolCallPrepareMessage(randomUUID(), "paper_score", JSON.stringify({ paper_id: "123" }), {
      status: "streaming",
    });
    updateStreamingMessage((prev) => ({ ...prev, parts: [...prev.parts, newMessage] }));
    withDelay(() => {
      const newParts = useStreamingStateMachine.getState().streamingMessage.parts.map((part) =>
        part.id === newMessage.id
          ? {
              ...part,
              status: part.status === "streaming" ? ("complete" as const) : part.status,
            }
          : part,
      ) as InternalMessage[];
      updateStreamingMessage((prev) => ({ ...prev, parts: [...newParts] }));
    });
  };
  const handleAddStreamingToolCall = (type: "greeting" | "paper_score") => {
    const isGreeting = type === "greeting";
    const newMessage = isGreeting
      ? createToolCallMessage(randomUUID(), "greeting", JSON.stringify({ name: "Junyi" }), {
          result: "preparing",
          status: "streaming",
        })
      : createToolCallMessage(randomUUID(), "paper_score", JSON.stringify({ paper_id: "123" }), {
          result: '<RESULT>{ "percentile": 0.74829 }</RESULT><INSTRUCTION>123</INSTRUCTION>',
          status: "streaming",
        });
    updateStreamingMessage((prev) => ({ ...prev, parts: [...prev.parts, newMessage] }));
    withDelay(() => {
      const newParts = useStreamingStateMachine.getState().streamingMessage.parts.map((part) => {
        if (part.id !== newMessage.id) return part;
        if (part.role !== "toolCall") return part;
        return {
          ...part,
          status: "complete" as const,
          data: isGreeting ? { ...part.data, result: "Hello, Junyi!" } : part.data,
        };
      }) as InternalMessage[];
      updateStreamingMessage((prev) => ({ ...prev, parts: [...newParts] }));
    });
  };
  const handleAddStreamingAssistant = () => {
    const newMessage = createAssistantMessage(randomUUID(), "Assistant Response Preparing " + randomText(), {
      modelSlug: "gpt-5.1",
      status: "streaming",
    });
    updateStreamingMessage((prev) => ({ ...prev, parts: [...prev.parts, newMessage] }));
    withDelay(() => {
      const newParts = useStreamingStateMachine.getState().streamingMessage.parts.map((part) => {
        if (part.id !== newMessage.id) return part;
        if (part.role !== "assistant") return part;
        return {
          ...part,
          status: "complete" as const,
          data: {
            ...part.data,
            content: "Assistant Response Finalized " + randomText(),
          },
        };
      }) as InternalMessage[];
      updateStreamingMessage((prev) => ({ ...prev, parts: [...newParts] }));
    });
  };

  // --- Render ---
  return (
    <div className="flex flex-col w-full max-h-full bg-orange-50 border-2 border-orange-600! rounded-lg overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 bg-orange-100 border-b-2 border-orange-600!">
        <h1 className="text-2xl font-bold text-center text-orange-700">DevTools</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-4">
          {/* Conversation section */}
          <div className="flex flex-col gap-3 p-3 bg-white rounded-lg border border-orange-200!">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-orange-700 flex items-center gap-2">
                Conversation (
                {isEmptyConversation() ? (
                  <span className="text-red-500 font-normal">empty</span>
                ) : (
                  <span className="text-green-500 font-normal">not empty</span>
                )}
                )
              </h2>
              <Button size="sm" onPress={startFromScratch} className="shrink-0">
                Create Dummy Conversation
              </Button>
            </div>

            {/* Selected Text */}
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-gray-700">Selected Text</h3>
              <div className="flex flex-row gap-2 items-center">
                <Input
                  className="flex-1"
                  size="sm"
                  placeholder="Selected Text"
                  value={selectedText ?? ""}
                  onChange={handleSelectedTextChange}
                />
                <Button size="sm" onPress={handleClearSelectedText} className="shrink-0">
                  Clear
                </Button>
              </div>
            </div>

            {/* Finalized Messages */}
            <div className="flex flex-col gap-2 pt-2 border-t border-orange-200!">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Finalized Messages ({currentConversation.messages.length})
                </h3>
                <Button size="sm" variant="light" onPress={handleClearConversation} className="h-7 min-w-16">
                  Clear
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <Button size="sm" onPress={handleAddUserMessage} className="w-full">
                  👨🏻‍💻 Add User Message
                </Button>
                <Button size="sm" onPress={handleAddAssistantMessage} className="w-full">
                  👮🏻‍♂️ Add Assistant Message
                </Button>
                <Button size="sm" onPress={() => handleAddToolCallMessage("greeting")} className="w-full">
                  👋 Add Tool Call Message (Greeting)
                </Button>
                <Button size="sm" onPress={() => handleAddToolCallMessage("paper_score")} className="w-full">
                  📄 Add Tool Call Message (PaperScore)
                </Button>
                <Button size="sm" onPress={handleStaleLastConversationMessage} className="w-full">
                  ⏳ Stale the last message
                </Button>
              </div>
            </div>
          </div>

          {/* Streaming Message section */}
          <div className="flex flex-col gap-3 p-3 bg-white rounded-lg border border-orange-200!">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-700">Streaming Message</h3>
              <Button size="sm" variant="light" onPress={handleClearStreamingMessage} className="h-7 min-w-16">
                Clear
              </Button>
            </div>
            <div className="text-xs text-gray-600 flex flex-wrap gap-1">
              <span>({streamingMessage.parts.length} total,</span>
              <span className="text-orange-600">
                {streamingMessage.parts.filter((part) => part.status === "streaming").length} preparing,
              </span>
              <span className="text-green-600">
                {streamingMessage.parts.filter((part) => part.status === "complete").length} finalized,
              </span>
              <span className="text-red-600">
                {streamingMessage.parts.filter((part) => part.status === "error").length} error,
              </span>
              <span className="text-gray-500">
                {streamingMessage.parts.filter((part) => part.status === "stale").length} stale
              </span>
              <span>)</span>
            </div>

            {/* Preparing delay */}
            <div className="flex flex-row gap-2 items-center pt-2 border-t border-orange-200!">
              <label htmlFor="preparing-delay-input" className="text-sm text-gray-700 whitespace-nowrap">
                Preparing delay (seconds):
              </label>
              <Input
                id="preparing-delay-input"
                size="sm"
                type="number"
                min="0"
                className="w-20"
                value={preparingDelay.toString()}
                onChange={(e) => setPreparingDelay(Number(e.target.value) || 0)}
              />
            </div>

            {/* Streaming buttons */}
            <div className="flex flex-col gap-2 pt-2 border-t border-orange-200!">
              <Button size="sm" onPress={handleAddStreamingUserMessage} className="w-full">
                Add User Message
              </Button>
              <Button size="sm" onPress={handleAddStreamingToolPrepare} className="w-full">
                Add Tool Prepare Message
              </Button>
              <Button size="sm" onPress={() => handleAddStreamingToolCall("paper_score")} className="w-full">
                Add Tool Call Message (PaperScore) stream
              </Button>
              <Button size="sm" onPress={() => handleAddStreamingToolCall("greeting")} className="w-full">
                Add Greeting Tool Call Message
              </Button>
              <Button size="sm" onPress={handleAddStreamingAssistant} className="w-full">
                Add assistant response
              </Button>
              <Button size="sm" onPress={handleStaleLastStreamingMessage} className="w-full">
                Stale the last message
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
