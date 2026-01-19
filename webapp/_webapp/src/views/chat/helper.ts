import {
  Conversation,
  Message,
  MessageTypeAssistant,
  MessageTypeToolCall,
  MessageTypeToolCallPrepareArguments,
  MessageTypeUnknown,
  MessageTypeUser,
} from "../../pkg/gen/apiclient/chat/v2/chat_pb";
import { MessageEntry, MessageEntryStatus } from "../../stores/streaming";
import { useMessageStore } from "../../stores/message-store";
import { DisplayMessage } from "../../stores/types";

// ============================================================================
// Message-based helpers (existing, for backward compatibility)
// ============================================================================

export function getPrevUserMessage(messages: Message[], currentIndex: number): MessageTypeUser | undefined {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (messages[i].payload?.messageType.case === "user") {
      return messages[i].payload?.messageType.value as MessageTypeUser;
    }
  }
  return undefined;
}

/**
 * Check if the current conversation is empty.
 * Uses the unified message store for consistent behavior.
 */
export function isEmptyConversation(): boolean {
  const state = useMessageStore.getState();
  const allMessages = state.getAllDisplayMessages();
  const visibleMessages = allMessages.filter((msg) => {
    if (msg.type === "user") return msg.content.length > 0;
    if (msg.type === "assistant") return msg.content.length > 0;
    if (msg.type === "toolCall" || msg.type === "toolCallPrepare") return true;
    return false;
  });
  return visibleMessages.length === 0;
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

// ============================================================================
// DisplayMessage-based helpers (new unified approach)
// ============================================================================

/**
 * Get the previous user message's selected text from a DisplayMessage array.
 */
export function getPrevUserSelectedText(
  messages: DisplayMessage[],
  currentIndex: number
): string | undefined {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (messages[i].type === "user") {
      return messages[i].selectedText;
    }
  }
  return undefined;
}

/**
 * Check if a DisplayMessage is the last user message in the array.
 */
export function isLastUserMessage(
  messages: DisplayMessage[],
  index: number
): boolean {
  const msg = messages[index];
  if (msg.type !== "user") return false;
  
  // Check if there are any user messages after this one
  for (let i = index + 1; i < messages.length; i++) {
    if (messages[i].type === "user") {
      return false;
    }
  }
  return true;
}

/**
 * Find the index of the last user message in the array.
 */
export function findLastUserMessageIndex(messages: DisplayMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === "user") {
      return i;
    }
  }
  return -1;
}

/**
 * Convert DisplayMessage back to MessageEntry for backward compatibility with MessageCard.
 * This is a temporary bridge until MessageCard is updated to use DisplayMessage directly.
 */
export function displayMessageToMessageEntry(msg: DisplayMessage): MessageEntry {
  const status = displayStatusToEntryStatus(msg.status);
  
  const entry: MessageEntry = {
    messageId: msg.id,
    status,
  };
  
  if (msg.type === "user") {
    entry.user = {
      content: msg.content,
      selectedText: msg.selectedText ?? "",
      surrounding: undefined,
      $typeName: "chat.v2.MessageTypeUser",
    } as MessageTypeUser;
  } else if (msg.type === "assistant") {
    entry.assistant = {
      content: msg.content,
      reasoning: msg.reasoning,
      $typeName: "chat.v2.MessageTypeAssistant",
    } as MessageTypeAssistant;
  } else if (msg.type === "toolCall") {
    entry.toolCall = {
      name: msg.toolName ?? "",
      args: msg.toolArgs ?? "",
      result: msg.toolResult ?? "",
      error: msg.toolError ?? "",
      $typeName: "chat.v2.MessageTypeToolCall",
    } as MessageTypeToolCall;
  } else if (msg.type === "toolCallPrepare") {
    entry.toolCallPrepareArguments = {
      name: msg.toolName ?? "",
      args: msg.toolArgs ?? "",
      $typeName: "chat.v2.MessageTypeToolCallPrepareArguments",
    } as MessageTypeToolCallPrepareArguments;
  }
  
  return entry;
}

function displayStatusToEntryStatus(status: DisplayMessage["status"]): MessageEntryStatus {
  switch (status) {
    case "streaming":
      return MessageEntryStatus.PREPARING;
    case "complete":
      return MessageEntryStatus.FINALIZED;
    case "stale":
      return MessageEntryStatus.STALE;
    case "error":
      return MessageEntryStatus.INCOMPLETE;
    default:
      return MessageEntryStatus.FINALIZED;
  }
}

