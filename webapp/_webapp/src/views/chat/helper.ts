import { Conversation, Message, MessageTypeUser } from "../../pkg/gen/apiclient/chat/v2/chat_pb";
import { useMessageStore } from "../../stores/message-store";
import { DisplayMessage } from "../../stores/types";
import { fromApiMessage } from "../../utils/message-converters";
import { InternalMessage } from "../../stores/streaming";

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
  const allMessages = state.allDisplayMessages;
  const visibleMessages = allMessages.filter((msg) => {
    if (msg.type === "user") return msg.content.length > 0;
    if (msg.type === "assistant") return msg.content.length > 0 || (msg.reasoning?.length ?? 0) > 0;
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

/**
 * Convert a protobuf Message to InternalMessage.
 * This is a convenience function that uses the unified converter.
 */
export function messageToInternalMessage(message: Message): InternalMessage | null {
  return fromApiMessage(message);
}

// ============================================================================
// DisplayMessage-based helpers (new unified approach)
// ============================================================================

/**
 * Get the previous user message's selected text from a DisplayMessage array.
 */
export function getPrevUserSelectedText(messages: DisplayMessage[], currentIndex: number): string | undefined {
  let selectedText = undefined;
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (messages[i].type === "user") {
      selectedText = messages[i].selectedText;
      if (selectedText) {
        break;
      }
    }
  }
  return selectedText;
}

/**
 * Check if a DisplayMessage is the last user message in the array.
 */
export function isLastUserMessage(messages: DisplayMessage[], index: number): boolean {
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
