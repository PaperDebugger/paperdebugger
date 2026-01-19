/**
 * Message Converters
 *
 * Bidirectional converters between protobuf Message, MessageEntry, and DisplayMessage types.
 * These provide the bridge between API types and UI types.
 */

import { Message } from "../pkg/gen/apiclient/chat/v2/chat_pb";
import { MessageEntry, MessageEntryStatus } from "./streaming/types";
import { DisplayMessage, DisplayMessageStatus } from "./types";

// ============================================================================
// Message → DisplayMessage (for finalized messages from server)
// ============================================================================

/**
 * Convert a finalized Message to DisplayMessage.
 * @returns DisplayMessage or null if the message type is not displayable
 */
export function messageToDisplayMessage(msg: Message): DisplayMessage | null {
  const messageType = msg.payload?.messageType;

  if (!messageType) return null;

  switch (messageType.case) {
    case "user":
      return {
        id: msg.messageId,
        type: "user",
        status: "complete",
        content: messageType.value.content,
        selectedText: messageType.value.selectedText,
      };

    case "assistant":
      return {
        id: msg.messageId,
        type: "assistant",
        status: "complete",
        content: messageType.value.content,
        reasoning: messageType.value.reasoning,
      };

    case "toolCall":
      return {
        id: msg.messageId,
        type: "toolCall",
        status: "complete",
        content: "",
        toolName: messageType.value.name,
        toolArgs: messageType.value.args,
        toolResult: messageType.value.result,
        toolError: messageType.value.error,
      };

    case "toolCallPrepareArguments":
      return {
        id: msg.messageId,
        type: "toolCallPrepare",
        status: "complete",
        content: "",
        toolName: messageType.value.name,
        toolArgs: messageType.value.args,
      };

    default:
      return null;
  }
}

// ============================================================================
// MessageEntry → DisplayMessage (for streaming messages)
// ============================================================================

/**
 * Convert a streaming MessageEntry to DisplayMessage.
 * @returns DisplayMessage or null if the entry type is not displayable
 */
export function messageEntryToDisplayMessage(entry: MessageEntry): DisplayMessage | null {
  const status = entryStatusToDisplayStatus(entry.status);

  if (entry.user) {
    return {
      id: entry.messageId,
      type: "user",
      status,
      content: entry.user.content,
      selectedText: entry.user.selectedText,
    };
  }

  if (entry.assistant) {
    return {
      id: entry.messageId,
      type: "assistant",
      status,
      content: entry.assistant.content,
      reasoning: entry.assistant.reasoning,
    };
  }

  if (entry.toolCall) {
    return {
      id: entry.messageId,
      type: "toolCall",
      status,
      content: "",
      toolName: entry.toolCall.name,
      toolArgs: entry.toolCall.args,
      toolResult: entry.toolCall.result,
      toolError: entry.toolCall.error,
    };
  }

  if (entry.toolCallPrepareArguments) {
    return {
      id: entry.messageId,
      type: "toolCallPrepare",
      status,
      content: "",
      toolName: entry.toolCallPrepareArguments.name,
      toolArgs: entry.toolCallPrepareArguments.args,
    };
  }

  return null;
}

// ============================================================================
// Status Converters
// ============================================================================

/**
 * Convert MessageEntryStatus to DisplayMessageStatus.
 */
function entryStatusToDisplayStatus(status: MessageEntryStatus): DisplayMessageStatus {
  switch (status) {
    case MessageEntryStatus.PREPARING:
      return "streaming";
    case MessageEntryStatus.FINALIZED:
      return "complete";
    case MessageEntryStatus.STALE:
      return "stale";
    case MessageEntryStatus.INCOMPLETE:
      return "error";
    default:
      return "complete";
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a DisplayMessage should be visible in the chat.
 * Filters out empty messages and system messages.
 */
export function isDisplayableMessage(msg: DisplayMessage): boolean {
  if (msg.type === "user") {
    return msg.content.length > 0;
  }
  if (msg.type === "assistant") {
    return msg.content.length > 0;
  }
  if (msg.type === "toolCall" || msg.type === "toolCallPrepare") {
    return true;
  }
  return false;
}

/**
 * Filter display messages to only include visible ones.
 */
export function filterDisplayMessages(messages: DisplayMessage[]): DisplayMessage[] {
  return messages.filter(isDisplayableMessage);
}
