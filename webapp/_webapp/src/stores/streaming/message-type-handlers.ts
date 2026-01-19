/**
 * Message Type Handlers Registry
 *
 * This module provides a registry of handlers for different message types,
 * eliminating the duplicate switch/if-else statements spread across multiple files.
 *
 * Benefits:
 * - Adding a new message type only requires adding one handler
 * - Type-safe handling with exhaustive checking
 * - Clear separation of concerns for each message type
 */

import {
  MessageTypeAssistant,
  MessageTypeToolCall,
  MessageTypeToolCallPrepareArguments,
  StreamPartBegin,
  StreamPartEnd,
} from "../../pkg/gen/apiclient/chat/v2/chat_pb";
import {
  MessageEntry,
  MessageEntryStatus,
  MessageRole,
  MessageTypeHandler,
  MessageTypeHandlerRegistry,
} from "./types";

// ============================================================================
// Handler Implementations
// ============================================================================

/**
 * Handler for assistant messages.
 */
class AssistantHandler implements MessageTypeHandler {
  onPartBegin(partBegin: StreamPartBegin): MessageEntry | null {
    return {
      messageId: partBegin.messageId,
      status: MessageEntryStatus.PREPARING,
      assistant: partBegin.payload?.messageType.value as MessageTypeAssistant,
    };
  }

  onPartEnd(partEnd: StreamPartEnd, _existingEntry: MessageEntry): Partial<MessageEntry> | null {
    const assistantMessage = partEnd.payload?.messageType.value as MessageTypeAssistant;
    return {
      status: MessageEntryStatus.FINALIZED,
      assistant: assistantMessage,
    };
  }
}

/**
 * Handler for tool call preparation (arguments streaming).
 */
class ToolCallPrepareHandler implements MessageTypeHandler {
  onPartBegin(partBegin: StreamPartBegin): MessageEntry | null {
    return {
      messageId: partBegin.messageId,
      status: MessageEntryStatus.PREPARING,
      toolCallPrepareArguments: partBegin.payload?.messageType
        .value as MessageTypeToolCallPrepareArguments,
    };
  }

  onPartEnd(partEnd: StreamPartEnd, _existingEntry: MessageEntry): Partial<MessageEntry> | null {
    const toolCallPrepareArguments = partEnd.payload?.messageType
      .value as MessageTypeToolCallPrepareArguments;
    return {
      status: MessageEntryStatus.FINALIZED,
      toolCallPrepareArguments,
    };
  }
}

/**
 * Handler for completed tool calls.
 */
class ToolCallHandler implements MessageTypeHandler {
  onPartBegin(partBegin: StreamPartBegin): MessageEntry | null {
    return {
      messageId: partBegin.messageId,
      status: MessageEntryStatus.PREPARING,
      toolCall: partBegin.payload?.messageType.value as MessageTypeToolCall,
    };
  }

  onPartEnd(partEnd: StreamPartEnd, _existingEntry: MessageEntry): Partial<MessageEntry> | null {
    const toolCall = partEnd.payload?.messageType.value as MessageTypeToolCall;
    return {
      status: MessageEntryStatus.FINALIZED,
      toolCall,
    };
  }
}

/**
 * No-op handler for message types that don't require streaming handling.
 * Used for system, user, and unknown message types.
 */
class NoOpHandler implements MessageTypeHandler {
  onPartBegin(_partBegin: StreamPartBegin): MessageEntry | null {
    return null;
  }

  onPartEnd(_partEnd: StreamPartEnd, _existingEntry: MessageEntry): Partial<MessageEntry> | null {
    return null;
  }
}

// ============================================================================
// Handler Registry
// ============================================================================

/**
 * Registry mapping message roles to their handlers.
 * This eliminates the need for switch/if-else statements when handling different message types.
 */
export const messageTypeHandlers: MessageTypeHandlerRegistry = {
  assistant: new AssistantHandler(),
  toolCallPrepareArguments: new ToolCallPrepareHandler(),
  toolCall: new ToolCallHandler(),
  user: new NoOpHandler(),
  system: new NoOpHandler(),
  unknown: new NoOpHandler(),
};

/**
 * Get the handler for a specific message role.
 * Returns NoOpHandler for undefined/null roles.
 */
export function getMessageTypeHandler(role: MessageRole | undefined): MessageTypeHandler {
  if (!role) {
    return new NoOpHandler();
  }
  return messageTypeHandlers[role] || new NoOpHandler();
}

/**
 * Type guard to check if a role is a valid MessageRole.
 */
export function isValidMessageRole(role: unknown): role is MessageRole {
  return (
    role === "assistant" ||
    role === "toolCallPrepareArguments" ||
    role === "toolCall" ||
    role === "user" ||
    role === "system" ||
    role === "unknown"
  );
}
