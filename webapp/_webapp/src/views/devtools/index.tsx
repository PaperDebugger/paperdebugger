import { Rnd } from "react-rnd";
import { useSelectionStore } from "../../stores/selection-store";
import { Button, Input } from "@heroui/react";
import { useStreamingMessageStore } from "../../stores/streaming-message-store";
import { MessageEntry, MessageEntryStatus } from "../../stores/conversation/types";
import { useConversationStore } from "../../stores/conversation/conversation-store";
import { fromJson } from "../../libs/protobuf-utils";
import { MessageSchema } from "../../pkg/gen/apiclient/chat/v2/chat_pb";
import { isEmptyConversation } from "../chat/helper";
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
  const { streamingMessage, setStreamingMessage, updateStreamingMessage } = useStreamingMessageStore();
  const { startFromScratch, currentConversation, setCurrentConversation } = useConversationStore();
  const [preparingDelay, setPreparingDelay] = useState(2);

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
      msg.messageId === arr[arr.length - 1]?.messageId ? { ...msg, status: MessageEntryStatus.STALE } : msg,
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
    const newParts = useStreamingMessageStore
      .getState()
      .streamingMessage.parts.map((part, _, arr) =>
        part.messageId === arr[arr.length - 1]?.messageId ? { ...part, status: MessageEntryStatus.STALE } : part,
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
    const messageEntry: MessageEntry = {
      messageId: randomUUID(),
      status: MessageEntryStatus.PREPARING,
      user: {
        content: "User Message Preparing",
        selectedText: selectedText ?? "",
        $typeName: "chat.v2.MessageTypeUser",
      },
    };
    setStreamingMessage({ ...streamingMessage, parts: [...streamingMessage.parts, messageEntry] });
    withDelay(() => {
      const newParts = useStreamingMessageStore.getState().streamingMessage.parts.map((part) =>
        part.messageId === messageEntry.messageId
          ? {
              ...part,
              user: { ...part.user, content: "User Message Prepared", $typeName: "chat.v2.MessageTypeUser" },
              status: part.status === MessageEntryStatus.PREPARING ? MessageEntryStatus.FINALIZED : part.status,
            }
          : part,
      ) as MessageEntry[];
      setStreamingMessage({ ...streamingMessage, parts: [...newParts] });
    });
  };
  const handleAddStreamingToolPrepare = () => {
    const messageEntry: MessageEntry = {
      messageId: randomUUID(),
      status: MessageEntryStatus.PREPARING,
      toolCallPrepareArguments: {
        name: "paper_score",
        args: JSON.stringify({ paper_id: "123" }),
        $typeName: "chat.v2.MessageTypeToolCallPrepareArguments",
      },
    };
    updateStreamingMessage((prev) => ({ ...prev, parts: [...prev.parts, messageEntry] }));
    withDelay(() => {
      const newParts = useStreamingMessageStore.getState().streamingMessage.parts.map((part) =>
        part.messageId === messageEntry.messageId
          ? {
              ...part,
              status: part.status === MessageEntryStatus.PREPARING ? MessageEntryStatus.FINALIZED : part.status,
              toolCallPrepareArguments: {
                name: "paper_score",
                args: JSON.stringify({ paper_id: "123" }),
                $typeName: "chat.v2.MessageTypeToolCallPrepareArguments",
              },
            }
          : part,
      ) as MessageEntry[];
      updateStreamingMessage((prev) => ({ ...prev, parts: [...newParts] }));
    });
  };
  const handleAddStreamingToolCall = (type: "greeting" | "paper_score") => {
    const isGreeting = type === "greeting";
    const messageEntry: MessageEntry = {
      messageId: randomUUID(),
      status: MessageEntryStatus.PREPARING,
      toolCall: isGreeting
        ? {
            name: "greeting",
            args: JSON.stringify({ name: "Junyi" }),
            result: "preparing",
            error: "",
            $typeName: "chat.v2.MessageTypeToolCall",
          }
        : {
            name: "paper_score",
            args: JSON.stringify({ paper_id: "123" }),
            result: '<RESULT>{ "percentile": 0.74829 }</RESULT><INSTRUCTION>123</INSTRUCTION>',
            error: "",
            $typeName: "chat.v2.MessageTypeToolCall",
          },
    };
    updateStreamingMessage((prev) => ({ ...prev, parts: [...prev.parts, messageEntry] }));
    withDelay(() => {
      const newParts = useStreamingMessageStore.getState().streamingMessage.parts.map((part) =>
        part.messageId === messageEntry.messageId
          ? {
              ...part,
              status: part.status === MessageEntryStatus.PREPARING ? MessageEntryStatus.FINALIZED : part.status,
              toolCall: isGreeting
                ? { ...part.toolCall, result: "Hello, Junyi!", $typeName: "chat.v2.MessageTypeToolCall" }
                : { ...part.toolCall, $typeName: "chat.v2.MessageTypeToolCall" },
            }
          : part,
      ) as MessageEntry[];
      updateStreamingMessage((prev) => ({ ...prev, parts: [...newParts] }));
    });
  };
  const handleAddStreamingAssistant = () => {
    const messageEntry: MessageEntry = {
      messageId: randomUUID(),
      status: MessageEntryStatus.PREPARING,
      assistant: {
        content: "Assistant Response Preparing " + randomText(),
        modelSlug: "gpt-4.1",
        $typeName: "chat.v2.MessageTypeAssistant",
      },
    };
    updateStreamingMessage((prev) => ({ ...prev, parts: [...prev.parts, messageEntry] }));
    withDelay(() => {
      const newParts = useStreamingMessageStore.getState().streamingMessage.parts.map((part) =>
        part.messageId === messageEntry.messageId
          ? {
              ...part,
              status: MessageEntryStatus.FINALIZED,
              assistant: {
                ...part.assistant,
                content: "Assistant Response Finalized " + randomText(),
                modelSlug: "gpt-4.1",
                $typeName: "chat.v2.MessageTypeAssistant",
              },
            }
          : part,
      ) as MessageEntry[];
      updateStreamingMessage((prev) => ({ ...prev, parts: [...newParts] }));
    });
  };

  // --- Render ---
  const maxWidth = typeof window !== 'undefined' ? window.innerWidth / 2 : 800;
  const defaultWidth = Math.min(800, maxWidth);
  
  return (
    <Rnd
      style={{ zIndex: 1003 }}
      default={{ x: 0, y: 0, width: defaultWidth, height: 600 }}
      minWidth={400}
      minHeight={400}
      maxWidth={maxWidth}
      enableResizing={true}
      disableDragging={false}
    >
      <div className="flex flex-col w-full h-full bg-orange-50 border-2 border-orange-600 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 bg-orange-100 border-b-2 border-orange-600">
          <h1 className="text-2xl font-bold text-center text-orange-700">DevTools</h1>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="flex flex-col gap-4">
            {/* Conversation section */}
            <div className="flex flex-col gap-3 p-3 bg-white rounded-lg border border-orange-200">
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
                <Button size="sm" onPress={startFromScratch} className="flex-shrink-0">
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
                  <Button size="sm" onPress={handleClearSelectedText} className="flex-shrink-0">
                    Clear
                  </Button>
                </div>
              </div>

              {/* Finalized Messages */}
              <div className="flex flex-col gap-2 pt-2 border-t border-orange-200">
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
            <div className="flex flex-col gap-3 p-3 bg-white rounded-lg border border-orange-200">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-gray-700">Streaming Message</h3>
                <Button size="sm" variant="light" onPress={handleClearStreamingMessage} className="h-7 min-w-16">
                  Clear
                </Button>
              </div>
              <div className="text-xs text-gray-600 flex flex-wrap gap-1">
                <span>({streamingMessage.parts.length} total,</span>
                <span className="text-orange-600">
                  {streamingMessage.parts.filter((part) => part.status === MessageEntryStatus.PREPARING).length}{" "}
                  preparing,
                </span>
                <span className="text-green-600">
                  {streamingMessage.parts.filter((part) => part.status === MessageEntryStatus.FINALIZED).length}{" "}
                  finalized,
                </span>
                <span className="text-blue-600">
                  {streamingMessage.parts.filter((part) => part.status === MessageEntryStatus.INCOMPLETE).length}{" "}
                  incomplete,
                </span>
                <span className="text-gray-500">
                  {streamingMessage.parts.filter((part) => part.status === MessageEntryStatus.STALE).length} stale
                </span>
                <span>)</span>
              </div>

              {/* Preparing delay */}
              <div className="flex flex-row gap-2 items-center pt-2 border-t border-orange-200">
                <label className="text-sm text-gray-700 whitespace-nowrap">Preparing delay (seconds):</label>
                <Input
                  size="sm"
                  type="number"
                  min="0"
                  className="w-20"
                  value={preparingDelay.toString()}
                  onChange={(e) => setPreparingDelay(Number(e.target.value) || 0)}
                />
              </div>

              {/* Streaming buttons */}
              <div className="flex flex-col gap-2 pt-2 border-t border-orange-200">
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
    </Rnd>
  );
};
