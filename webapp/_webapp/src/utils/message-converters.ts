/**
 * Message Converters
 *
 * Bidirectional converters between API types (protobuf Message) and internal types (InternalMessage).
 * These provide the only two transformations needed:
 *
 * 1. API Response → InternalMessage (fromApiMessage)
 * 2. InternalMessage → API Request (toApiMessage)
 *
 * Benefits:
 * - Clear boundary between API types and internal types
 * - Reduces the number of data transformations from 5+ to 2
 * - All conversion logic in one place
 */

import {
    Message,
    MessageSchema,
    StreamPartBegin,
    StreamPartEnd,
  } from "../pkg/gen/apiclient/chat/v2/chat_pb";
  import { fromJson } from "../libs/protobuf-utils";
  import {
    InternalMessage,
    MessageStatus,
    createAssistantMessage,
    createToolCallMessage,
    createToolCallPrepareMessage,
  } from "../types/message";
  
  // ============================================================================
  // API Response → InternalMessage
  // ============================================================================
  
  /**
   * Convert a protobuf Message to InternalMessage.
   * This is used when receiving finalized messages from the server.
   *
   * @param msg The protobuf Message from the API
   * @param status Optional status override (default: "complete")
   * @returns InternalMessage or null if message type is not recognized
   */
  export function fromApiMessage(msg: Message, status: MessageStatus = "complete"): InternalMessage | null {
    const messageType = msg.payload?.messageType;
  
    if (!messageType) return null;
  
    switch (messageType.case) {
      case "user":
        return {
          id: msg.messageId,
          role: "user",
          status,
          timestamp: Number(msg.timestamp) || undefined,
          data: {
            content: messageType.value.content,
            selectedText: messageType.value.selectedText,
            surrounding: messageType.value.surrounding,
          },
        };
  
      case "assistant":
        return {
          id: msg.messageId,
          role: "assistant",
          status,
          timestamp: Number(msg.timestamp) || undefined,
          data: {
            content: messageType.value.content,
            reasoning: messageType.value.reasoning,
            modelSlug: messageType.value.modelSlug,
          },
        };
  
      case "toolCall":
        return {
          id: msg.messageId,
          role: "toolCall",
          status,
          timestamp: Number(msg.timestamp) || undefined,
          data: {
            name: messageType.value.name,
            args: messageType.value.args,
            result: messageType.value.result,
            error: messageType.value.error,
          },
        };
  
      case "toolCallPrepareArguments":
        return {
          id: msg.messageId,
          role: "toolCallPrepare",
          status,
          timestamp: Number(msg.timestamp) || undefined,
          data: {
            name: messageType.value.name,
            args: messageType.value.args,
          },
        };
  
      case "system":
        return {
          id: msg.messageId,
          role: "system",
          status,
          timestamp: Number(msg.timestamp) || undefined,
          data: {
            content: messageType.value.content,
          },
        };
  
      case "unknown":
        return {
          id: msg.messageId,
          role: "unknown",
          status,
          timestamp: Number(msg.timestamp) || undefined,
          data: {
            description: messageType.value.description,
          },
        };
  
      default:
        return null;
    }
  }
  
  // ============================================================================
  // InternalMessage → API Request
  // ============================================================================
  
  import { JsonValue } from "@bufbuild/protobuf";
  
  /**
   * Convert an InternalMessage to a protobuf Message.
   * This is used when sending messages to the server or storing in conversation state.
   *
   * @param msg The internal message
   * @returns Protobuf Message or undefined if conversion fails
   */
  export function toApiMessage(msg: InternalMessage): Message | undefined {
    switch (msg.role) {
      case "user":
        return fromJson(MessageSchema, {
          messageId: msg.id,
          payload: {
            user: {
              content: msg.data.content,
              selectedText: msg.data.selectedText ?? "",
            },
          },
        } as unknown as JsonValue);
  
      case "assistant": {
        const assistantPayload: { content: string; reasoning?: string; modelSlug?: string } = {
          content: msg.data.content,
        };
        if (msg.data.reasoning) {
          assistantPayload.reasoning = msg.data.reasoning;
        }
        if (msg.data.modelSlug) {
          assistantPayload.modelSlug = msg.data.modelSlug;
        }
        return fromJson(MessageSchema, {
          messageId: msg.id,
          payload: {
            assistant: assistantPayload,
          },
        } as unknown as JsonValue);
      }
  
      case "toolCall":
        return fromJson(MessageSchema, {
          messageId: msg.id,
          payload: {
            toolCall: {
              name: msg.data.name,
              args: msg.data.args,
              result: msg.data.result ?? "",
              error: msg.data.error ?? "",
            },
          },
        } as unknown as JsonValue);
  
      case "toolCallPrepare":
        return fromJson(MessageSchema, {
          messageId: msg.id,
          payload: {
            toolCallPrepareArguments: {
              name: msg.data.name,
              args: msg.data.args,
            },
          },
        } as unknown as JsonValue);
  
      case "system":
        return fromJson(MessageSchema, {
          messageId: msg.id,
          payload: {
            system: {
              content: msg.data.content,
            },
          },
        } as unknown as JsonValue);
  
      case "unknown":
        return fromJson(MessageSchema, {
          messageId: msg.id,
          payload: {
            unknown: {
              description: msg.data.description,
            },
          },
        } as unknown as JsonValue);
  
      default:
        return undefined;
    }
  }
  
  // ============================================================================
  // Stream Events → InternalMessage
  // ============================================================================
  
  /**
   * Create an InternalMessage from a StreamPartBegin event.
   * Used during streaming to initialize a new message entry.
   *
   * @param partBegin The stream part begin event
   * @returns InternalMessage or null if message type should be ignored
   */
  export function fromStreamPartBegin(partBegin: StreamPartBegin): InternalMessage | null {
    const messageType = partBegin.payload?.messageType;
  
    if (!messageType) return null;
  
    switch (messageType.case) {
      case "assistant":
        return createAssistantMessage(
          partBegin.messageId,
          messageType.value.content,
          {
            reasoning: messageType.value.reasoning,
            modelSlug: messageType.value.modelSlug,
            status: "streaming",
          }
        );
  
      case "toolCall":
        return createToolCallMessage(
          partBegin.messageId,
          messageType.value.name,
          messageType.value.args,
          {
            result: messageType.value.result,
            error: messageType.value.error,
            status: "streaming",
          }
        );
  
      case "toolCallPrepareArguments":
        return createToolCallPrepareMessage(
          partBegin.messageId,
          messageType.value.name,
          messageType.value.args,
          { status: "streaming" }
        );
  
      // User, system, and unknown messages are not handled via streaming
      case "user":
      case "system":
      case "unknown":
        return null;
  
      default:
        return null;
    }
  }
  
  /**
   * Get the updated data from a StreamPartEnd event.
   * Used to finalize a streaming message with complete data.
   *
   * @param partEnd The stream part end event
   * @param existingMessage The existing message to update
   * @returns Updated InternalMessage or null if update should be skipped
   */
  export function applyStreamPartEnd(
    partEnd: StreamPartEnd,
    existingMessage: InternalMessage
  ): InternalMessage | null {
    const messageType = partEnd.payload?.messageType;
  
    if (!messageType) return null;
  
    switch (messageType.case) {
      case "assistant":
        if (existingMessage.role !== "assistant") return null;
        return {
          ...existingMessage,
          status: "complete",
          data: {
            ...existingMessage.data,
            content: messageType.value.content,
            reasoning: messageType.value.reasoning,
            modelSlug: messageType.value.modelSlug,
          },
        };
  
      case "toolCall":
        if (existingMessage.role !== "toolCall") return null;
        return {
          ...existingMessage,
          status: "complete",
          data: {
            name: messageType.value.name,
            args: messageType.value.args,
            result: messageType.value.result,
            error: messageType.value.error,
          },
        };
  
      case "toolCallPrepareArguments":
        if (existingMessage.role !== "toolCallPrepare") return null;
        return {
          ...existingMessage,
          status: "complete",
          data: {
            name: messageType.value.name,
            args: messageType.value.args,
          },
        };
  
      // User, system, and unknown messages are not handled via streaming
      case "user":
      case "system":
      case "unknown":
        return null;
  
      default:
        return null;
    }
  }
  
  // ============================================================================
  // InternalMessage ↔ DisplayMessage
  // ============================================================================
  
  import { DisplayMessage, DisplayMessageStatus } from "../stores/types";
  
  /**
   * Convert InternalMessage to DisplayMessage.
   * This is a simple 1:1 mapping in most cases.
   *
   * @param msg The internal message
   * @returns DisplayMessage or null if message should not be displayed
   */
  export function toDisplayMessage(msg: InternalMessage): DisplayMessage | null {
    switch (msg.role) {
      case "user":
        return {
          id: msg.id,
          type: "user",
          status: msg.status as DisplayMessageStatus,
          content: msg.data.content,
          selectedText: msg.data.selectedText,
        };
  
      case "assistant":
        return {
          id: msg.id,
          type: "assistant",
          status: msg.status as DisplayMessageStatus,
          content: msg.data.content,
          reasoning: msg.data.reasoning,
        };
  
      case "toolCall":
        return {
          id: msg.id,
          type: "toolCall",
          status: msg.status as DisplayMessageStatus,
          content: "",
          toolName: msg.data.name,
          toolArgs: msg.data.args,
          toolResult: msg.data.result,
          toolError: msg.data.error,
        };
  
      case "toolCallPrepare":
        return {
          id: msg.id,
          type: "toolCallPrepare",
          status: msg.status as DisplayMessageStatus,
          content: "",
          toolName: msg.data.name,
          toolArgs: msg.data.args,
        };
  
      // System and unknown messages are typically not displayed
      case "system":
      case "unknown":
        return null;
  
      default:
        return null;
    }
  }
  
  /**
   * Convert DisplayMessage back to InternalMessage.
   * Used for backward compatibility with components that need InternalMessage.
   *
   * @param msg The display message
   * @returns InternalMessage
   */
  export function fromDisplayMessage(msg: DisplayMessage): InternalMessage {
    const status = msg.status as MessageStatus;
  
    switch (msg.type) {
      case "user":
        return {
          id: msg.id,
          role: "user",
          status,
          data: {
            content: msg.content,
            selectedText: msg.selectedText,
          },
        };
  
      case "assistant":
        return {
          id: msg.id,
          role: "assistant",
          status,
          data: {
            content: msg.content,
            reasoning: msg.reasoning,
          },
        };
  
      case "toolCall":
        return {
          id: msg.id,
          role: "toolCall",
          status,
          data: {
            name: msg.toolName ?? "",
            args: msg.toolArgs ?? "",
            result: msg.toolResult,
            error: msg.toolError,
          },
        };
  
      case "toolCallPrepare":
        return {
          id: msg.id,
          role: "toolCallPrepare",
          status,
          data: {
            name: msg.toolName ?? "",
            args: msg.toolArgs ?? "",
          },
        };
  
      case "error":
      default:
        return {
          id: msg.id,
          role: "unknown",
          status,
          data: {
            description: msg.content,
          },
        };
    }
  }
  
  // Re-export factory functions for convenience
  export { createAssistantMessage, createToolCallMessage, createToolCallPrepareMessage };
  