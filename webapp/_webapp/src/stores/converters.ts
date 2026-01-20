/**
 * Message Converters
 *
 * Bidirectional converters between protobuf Message, InternalMessage, and DisplayMessage types.
 * These provide the bridge between API types and UI types.
 */

import { Message } from "../pkg/gen/apiclient/chat/v2/chat_pb";
import { InternalMessage } from "./streaming/types";
import { DisplayMessage } from "./types";
import {
  fromApiMessage,
  toDisplayMessage,
} from "../utils/message-converters";

// ============================================================================
// Message → DisplayMessage (for finalized messages from server)
// ============================================================================

/**
 * Convert a finalized Message to DisplayMessage.
 * Uses the unified converter pipeline: Message → InternalMessage → DisplayMessage
 *
 * @returns DisplayMessage or null if the message type is not displayable
 */
export function messageToDisplayMessage(msg: Message): DisplayMessage | null {
  // Use the new unified converter: API Message → InternalMessage → DisplayMessage
  const internalMsg = fromApiMessage(msg);
  if (!internalMsg) return null;
  return toDisplayMessage(internalMsg);
}

// ============================================================================
// InternalMessage → DisplayMessage (for streaming messages)
// ============================================================================

/**
 * Convert an InternalMessage to DisplayMessage.
 * This is the primary converter for both API and streaming messages.
 *
 * @returns DisplayMessage or null if the message type is not displayable
 */
export function internalMessageToDisplayMessage(msg: InternalMessage): DisplayMessage | null {
  return toDisplayMessage(msg);
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
    return msg.content.length > 0 || (msg.reasoning?.length ?? 0) > 0;
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
