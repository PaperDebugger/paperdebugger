import {
  Conversation,
  Message,
  MessageTypeAssistant,
  MessageTypeToolCall,
  MessageTypeToolCallPrepareArguments,
  MessageTypeUnknown,
  MessageTypeUser,
} from "../../pkg/gen/apiclient/chat/v1/chat_pb";
import { useConversationStore } from "../../stores/conversation/conversation-store";
import { MessageEntry, MessageEntryStatus } from "../../stores/conversation/types";
import { useStreamingMessageStore } from "../../stores/streaming-message-store";

export function getPrevUserMessage(messages: Message[], currentIndex: number): MessageTypeUser | undefined {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (messages[i].payload?.messageType.case === "user") {
      return messages[i].payload?.messageType.value as MessageTypeUser;
    }
  }
  return undefined;
}

export function isEmptyConversation(): boolean {
  const converstaion = useConversationStore.getState().currentConversation;
  const visibleMessages = filterVisibleMessages(converstaion);
  const streamingMessage = useStreamingMessageStore.getState().streamingMessage;
  return visibleMessages.length === 0 && streamingMessage.parts.length === 0;
}

export function filterVisibleMessages(conversation?: Conversation): Message[] {
  return (
    conversation?.messages.filter((m) => {
      if (m.payload?.messageType.case === "user") {
        return m.payload?.messageType.value.content.length > 0;
      }
      if (m.payload?.messageType.case === "assistant") {
        return m.payload?.messageType.value.content.length > 0;
      }
      if (m.payload?.messageType.case === "toolCall") {
        return true;
      }
      return false;
    }) || []
  );
}

export function messageToMessageEntry(message: Message): MessageEntry {
  return {
    messageId: message.messageId,
    status: MessageEntryStatus.FINALIZED,
    assistant:
      message.payload?.messageType.case === "assistant"
        ? (message.payload?.messageType.value as MessageTypeAssistant)
        : undefined,
    user:
      message.payload?.messageType.case === "user"
        ? (message.payload?.messageType.value as MessageTypeUser)
        : undefined,
    toolCall:
      message.payload?.messageType.case === "toolCall"
        ? (message.payload?.messageType.value as MessageTypeToolCall)
        : undefined,
    toolCallPrepareArguments:
      message.payload?.messageType.case === "toolCallPrepareArguments"
        ? (message.payload?.messageType.value as MessageTypeToolCallPrepareArguments)
        : undefined,
    unknown:
      message.payload?.messageType.case === "unknown"
        ? (message.payload?.messageType.value as MessageTypeUnknown)
        : undefined,
  } as MessageEntry;
}
