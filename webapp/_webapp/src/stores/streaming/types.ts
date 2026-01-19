/**
 * Streaming State Machine Types
 *
 * This file defines all types used by the streaming state machine,
 * consolidating the fragmented type definitions across multiple handler files.
 */

import {
  IncompleteIndicator,
  MessageChunk,
  ReasoningChunk,
  StreamError,
  StreamFinalization,
  StreamInitialization,
  StreamPartBegin,
  StreamPartEnd,
  MessageTypeAssistant,
  MessageTypeToolCall,
  MessageTypeToolCallPrepareArguments,
  MessageTypeUnknown,
  MessageTypeUser,
} from "../../pkg/gen/apiclient/chat/v2/chat_pb";

// ============================================================================
// Stream State
// ============================================================================

/**
 * Represents the current state of the streaming process.
 */
export type StreamState = "idle" | "receiving" | "finalizing" | "error";

// ============================================================================
// Message Entry Types
// ============================================================================

/**
 * Status of a message entry during the streaming lifecycle.
 */
export enum MessageEntryStatus {
  PREPARING = "PREPARING",
  FINALIZED = "FINALIZED",
  INCOMPLETE = "INCOMPLETE",
  STALE = "STALE",
}

/**
 * Represents a message entry in the streaming state.
 * Uses a discriminated union pattern for type safety.
 */
export type MessageEntry = {
  messageId: string;
  status: MessageEntryStatus;
  // Role-specific content (only one will be present)
  user?: MessageTypeUser;
  assistant?: MessageTypeAssistant;
  toolCallPrepareArguments?: MessageTypeToolCallPrepareArguments;
  toolCall?: MessageTypeToolCall;
  unknown?: MessageTypeUnknown;
};

/**
 * The current streaming message state.
 */
export type StreamingMessage = {
  parts: MessageEntry[];
  sequence: number;
};

// ============================================================================
// Stream Events
// ============================================================================

/**
 * Union type representing all possible stream events.
 * This enables type-safe, exhaustive event handling in the state machine.
 */
export type StreamEvent =
  | { type: "INIT"; payload: StreamInitialization }
  | { type: "PART_BEGIN"; payload: StreamPartBegin }
  | { type: "CHUNK"; payload: MessageChunk }
  | { type: "REASONING_CHUNK"; payload: ReasoningChunk }
  | { type: "PART_END"; payload: StreamPartEnd }
  | { type: "FINALIZE"; payload: StreamFinalization }
  | { type: "ERROR"; payload: StreamError }
  | { type: "INCOMPLETE"; payload: IncompleteIndicator }
  | { type: "CONNECTION_ERROR"; payload: Error };

/**
 * Extract the payload type for a given event type.
 */
export type StreamEventPayload<T extends StreamEvent["type"]> = Extract<
  StreamEvent,
  { type: T }
>["payload"];

// ============================================================================
// Message Roles
// ============================================================================

/**
 * All possible message roles from the protobuf MessagePayload.
 */
export type MessageRole =
  | "assistant"
  | "toolCallPrepareArguments"
  | "toolCall"
  | "user"
  | "system"
  | "unknown";

// ============================================================================
// Handler Interfaces
// ============================================================================

/**
 * Context provided to stream event handlers.
 */
export interface StreamHandlerContext {
  /** Callback to refetch the conversation list */
  refetchConversationList: () => void;
  /** User ID for error handling */
  userId: string;
  /** Current prompt for retry scenarios */
  currentPrompt: string;
  /** Current selected text for retry scenarios */
  currentSelectedText: string;
  /** Sync function for project synchronization */
  sync: () => Promise<{ success: boolean; error?: Error }>;
  /** Send message function for retry scenarios */
  sendMessageStream: (message: string, selectedText: string) => Promise<void>;
}

/**
 * Interface for message type-specific handlers.
 * Implementations handle the creation and finalization of specific message types.
 */
export interface MessageTypeHandler {
  /**
   * Called when a stream part begins for this message type.
   * @returns A new MessageEntry or null if this type should be ignored.
   */
  onPartBegin(partBegin: StreamPartBegin): MessageEntry | null;

  /**
   * Called when a stream part ends for this message type.
   * @returns Updated fields to merge into the existing entry, or null to skip.
   */
  onPartEnd(partEnd: StreamPartEnd, existingEntry: MessageEntry): Partial<MessageEntry> | null;
}

/**
 * Registry type for message type handlers.
 */
export type MessageTypeHandlerRegistry = Record<MessageRole, MessageTypeHandler>;
