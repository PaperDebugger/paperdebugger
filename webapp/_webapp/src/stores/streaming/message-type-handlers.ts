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
  InternalMessage,
  MessageRole,
  MessageTypeHandler,
  MessageTypeHandlerRegistry,
} from "./types";
import {
  createAssistantMessage,
  createToolCallMessage,
  createToolCallPrepareMessage,
} from "../../types/message";

// ============================================================================
// Handler Implementations
// ============================================================================

/**
 * Handler for assistant messages.
 */
class AssistantHandler implements MessageTypeHandler {
  onPartBegin(partBegin: StreamPartBegin): InternalMessage | null {
    const assistant = partBegin.payload?.messageType.value as MessageTypeAssistant;
    return createAssistantMessage(partBegin.messageId, assistant.content, {
      reasoning: assistant.reasoning,
      modelSlug: assistant.modelSlug,
      status: "streaming",
    });
  }

  onPartEnd(partEnd: StreamPartEnd, existingMessage: InternalMessage): InternalMessage | null {
    if (existingMessage.role !== "assistant") return null;
    const assistant = partEnd.payload?.messageType.value as MessageTypeAssistant;
    return {
      ...existingMessage,
      status: "complete",
      data: {
        content: assistant.content,
        reasoning: assistant.reasoning,
        modelSlug: assistant.modelSlug,
      },
    };
  }
}

/**
 * Handler for tool call preparation (arguments streaming).
 */
class ToolCallPrepareHandler implements MessageTypeHandler {
  onPartBegin(partBegin: StreamPartBegin): InternalMessage | null {
    const toolCallPrepare = partBegin.payload?.messageType.value as MessageTypeToolCallPrepareArguments;
    return createToolCallPrepareMessage(partBegin.messageId, toolCallPrepare.name, toolCallPrepare.args, {
      status: "streaming",
    });
  }

  onPartEnd(partEnd: StreamPartEnd, existingMessage: InternalMessage): InternalMessage | null {
    if (existingMessage.role !== "toolCallPrepare") return null;
    const toolCallPrepare = partEnd.payload?.messageType.value as MessageTypeToolCallPrepareArguments;
    return {
      ...existingMessage,
      status: "complete",
      data: {
        name: toolCallPrepare.name,
        args: toolCallPrepare.args,
      },
    };
  }
}

/**
 * Handler for completed tool calls.
 */
class ToolCallHandler implements MessageTypeHandler {
  onPartBegin(partBegin: StreamPartBegin): InternalMessage | null {
    const toolCall = partBegin.payload?.messageType.value as MessageTypeToolCall;
    return createToolCallMessage(partBegin.messageId, toolCall.name, toolCall.args, {
      result: toolCall.result,
      error: toolCall.error,
      status: "streaming",
    });
  }

  onPartEnd(partEnd: StreamPartEnd, existingMessage: InternalMessage): InternalMessage | null {
    if (existingMessage.role !== "toolCall") return null;
    const toolCall = partEnd.payload?.messageType.value as MessageTypeToolCall;
    return {
      ...existingMessage,
      status: "complete",
      data: {
        name: toolCall.name,
        args: toolCall.args,
        result: toolCall.result,
        error: toolCall.error,
      },
    };
  }
}

/**
 * No-op handler for message types that don't require streaming handling.
 * Used for system, user, and unknown message types.
 */
class NoOpHandler implements MessageTypeHandler {
  onPartBegin(_partBegin: StreamPartBegin): InternalMessage | null {
    return null;
  }

  onPartEnd(_partEnd: StreamPartEnd, _existingMessage: InternalMessage): InternalMessage | null {
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
