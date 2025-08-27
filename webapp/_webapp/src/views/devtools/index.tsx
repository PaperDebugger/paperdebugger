import { Rnd } from "react-rnd";
import { useSelectionStore } from "../../stores/selection-store";
import { Button, Input } from "@heroui/react";
import { useStreamingMessageStore } from "../../stores/streaming-message-store";
import { MessageEntry, MessageEntryStatus } from "../../stores/conversation/types";
import { useConversationStore } from "../../stores/conversation/conversation-store";
import { fromJson } from "@bufbuild/protobuf";
import { MessageSchema } from "../../pkg/gen/apiclient/chat/v1/chat_pb";
import { isEmptyConversation } from "../chat/helper";
import { useState } from "react";

// --- 工具函数 ---
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

// --- DevTools主组件 ---
export const DevTools = () => {
  // 状态管理
  const { selectedText, setSelectedText, setSelectionRange } = useSelectionStore();
  const { streamingMessage, setStreamingMessage, updateStreamingMessage } = useStreamingMessageStore();
  const { startFromScratch, currentConversation, setCurrentConversation } = useConversationStore();
  const [preparingDelay, setPreparingDelay] = useState(2);

  // --- 事件处理函数 ---
  // Conversation相关
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

  // SelectedText相关
  const handleClearSelectedText = () => {
    setSelectedText(null);
    setSelectionRange(null);
  };
  const handleSelectedTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedText(e.target.value);
    setSelectionRange(new Range());
  };

  // StreamingMessage相关
  const handleClearStreamingMessage = () => setStreamingMessage({ ...streamingMessage, parts: [] });
  const handleStaleLastStreamingMessage = () => {
    const newParts = useStreamingMessageStore
      .getState()
      .streamingMessage.parts.map((part, _, arr) =>
        part.messageId === arr[arr.length - 1]?.messageId ? { ...part, status: MessageEntryStatus.STALE } : part,
      );
    setStreamingMessage({ ...streamingMessage, parts: [...newParts] });
  };
  // 通用延迟处理
  const withDelay = (fn: () => void) => {
    if (preparingDelay > 0) setTimeout(fn, preparingDelay * 1000);
    else fn();
  };
  // StreamingMessage添加各类消息
  const handleAddStreamingUserMessage = () => {
    const messageEntry: MessageEntry = {
      messageId: randomUUID(),
      status: MessageEntryStatus.PREPARING,
      user: {
        content: "User Message Preparing",
        selectedText: selectedText ?? "",
        $typeName: "chat.v1.MessageTypeUser",
      },
    };
    setStreamingMessage({ ...streamingMessage, parts: [...streamingMessage.parts, messageEntry] });
    withDelay(() => {
      const newParts = useStreamingMessageStore.getState().streamingMessage.parts.map((part) =>
        part.messageId === messageEntry.messageId
          ? {
              ...part,
              user: { ...part.user, content: "User Message Prepared", $typeName: "chat.v1.MessageTypeUser" },
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
        $typeName: "chat.v1.MessageTypeToolCallPrepareArguments",
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
                $typeName: "chat.v1.MessageTypeToolCallPrepareArguments",
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
            $typeName: "chat.v1.MessageTypeToolCall",
          }
        : {
            name: "paper_score",
            args: JSON.stringify({ paper_id: "123" }),
            result: '<RESULT>{ "percentile": 0.74829 }</RESULT><INSTRUCTION>123</INSTRUCTION>',
            error: "",
            $typeName: "chat.v1.MessageTypeToolCall",
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
                ? { ...part.toolCall, result: "Hello, Junyi!", $typeName: "chat.v1.MessageTypeToolCall" }
                : { ...part.toolCall, $typeName: "chat.v1.MessageTypeToolCall" },
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
      assistant: { content: "Assistant Response Preparing " + randomText(), $typeName: "chat.v1.MessageTypeAssistant" },
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
                $typeName: "chat.v1.MessageTypeAssistant",
              },
            }
          : part,
      ) as MessageEntry[];
      updateStreamingMessage((prev) => ({ ...prev, parts: [...newParts] }));
    });
  };

  // --- 渲染 ---
  return (
    <Rnd
      style={{ zIndex: 1003, position: "static", top: 0, left: 0 }}
      default={{ x: 0, y: 0, width: 800, height: 600 }}
    >
      <div className="flex flex-col gap-2 w-full h-full bg-orange-100 border-2 border-orange-600 rounded-lg overflow-hidden p-2">
        <h1 className="text-2xl font-bold text-center text-orange-600">DevTools</h1>
        {/* Conversation 区块 */}
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            Conversation (
            {isEmptyConversation() ? (
              <span className="text-red-500">empty</span>
            ) : (
              <span className="text-green-500">not empty</span>
            )}
            )
            <Button size="sm" onPress={startFromScratch}>
              Create Dummy Conversation
            </Button>
          </h2>
          <div className="flex flex-row gap-2 items-center">
            <h3>Selected Text</h3>
            <Input
              className="flex-1"
              size="sm"
              placeholder="Selected Text"
              value={selectedText ?? ""}
              onChange={handleSelectedTextChange}
            />
            <Button size="sm" onPress={handleClearSelectedText}>
              Clear Selected Text
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2">
              Finalized Message ({currentConversation.messages.length})
              <Button className="h-8 w-8" onPress={handleClearConversation}>
                clear
              </Button>
            </h3>
            <div className="flex flex-col gap-2 items-center">
              <Button className="h-8 w-full" size="sm" onPress={handleAddUserMessage}>
                👨🏻‍💻 Add User Message
              </Button>
              <Button className="h-8 w-full" size="sm" onPress={handleAddAssistantMessage}>
                👮🏻‍♂️ Add Assistant Message
              </Button>
              <Button className="h-8 w-full" size="sm" onPress={() => handleAddToolCallMessage("greeting")}>
                👋 Add Tool Call Message (Greeting)
              </Button>
              <Button className="h-8 w-full" size="sm" onPress={() => handleAddToolCallMessage("paper_score")}>
                📄 Add Tool Call Message (PaperScore)
              </Button>
              <Button className="h-8 w-full" size="sm" onPress={handleStaleLastConversationMessage}>
                ⏳ Stale the last message
              </Button>
            </div>
          </div>
          {/* Streaming Message 区块 */}
          <div className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2">
              Streaming Message
              <div>
                ({streamingMessage.parts.length} total,
                {streamingMessage.parts.filter((part) => part.status === MessageEntryStatus.PREPARING).length}{" "}
                preparing,
                {streamingMessage.parts.filter((part) => part.status === MessageEntryStatus.FINALIZED).length}{" "}
                finalized,
                {streamingMessage.parts.filter((part) => part.status === MessageEntryStatus.INCOMPLETE).length}{" "}
                incomplete,
                {streamingMessage.parts.filter((part) => part.status === MessageEntryStatus.STALE).length} stale )
              </div>
              <Button className="h-8 w-8" onPress={handleClearStreamingMessage}>
                clear
              </Button>
            </h3>
            <div className="flex flex-row gap-2 items-center">
              <p className="text-nowrap">Preparing delay (seconds):</p>
              <Input
                size="sm"
                value={preparingDelay.toString()}
                onChange={(e) => setPreparingDelay(Number(e.target.value) || 0)}
              />
            </div>
            <Button size="sm" onPress={handleAddStreamingUserMessage}>
              Add User Message
            </Button>
            <Button size="sm" onPress={handleAddStreamingToolPrepare}>
              Add Tool Prepare Message
            </Button>
            <Button size="sm" onPress={() => handleAddStreamingToolCall("paper_score")}>
              Add Tool Call Message (PaperScore) stream
            </Button>
            <Button size="sm" onPress={() => handleAddStreamingToolCall("greeting")}>
              Add Greeting Tool Call Message
            </Button>
            <Button size="sm" onPress={handleAddStreamingAssistant}>
              Add assistant response
            </Button>
            <Button size="sm" onPress={handleStaleLastStreamingMessage}>
              Stale the last message
            </Button>
          </div>
        </div>
      </div>
    </Rnd>
  );
};
