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
} from "../../pkg/gen/apiclient/chat/v2/chat_pb";
import { InternalMessage, MessageStatus } from "../../types/message";

// Re-export InternalMessage for convenience
export type { InternalMessage, MessageStatus };

// ============================================================================
// Stream State
// ============================================================================

/**
 * Represents the current state of the streaming process.
 */
export type StreamState = "idle" | "receiving" | "finalizing" | "error";

// ============================================================================
// Streaming Message State
// ============================================================================

/**
 * The current streaming message state.
 * Now uses InternalMessage instead of the legacy MessageEntry.
 */
export type StreamingMessage = {
  parts: InternalMessage[];
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
   * @returns A new InternalMessage or null if this type should be ignored.
   */
  onPartBegin(partBegin: StreamPartBegin): InternalMessage | null;

  /**
   * Called when a stream part ends for this message type.
   * @returns Updated InternalMessage or null to skip.
   */
  onPartEnd(partEnd: StreamPartEnd, existingMessage: InternalMessage): InternalMessage | null;
}

/**
 * Registry type for message type handlers.
 */
export type MessageTypeHandlerRegistry = Record<MessageRole, MessageTypeHandler>;

// ============================================================================
// Error Handling Types (Phase 4)
// ============================================================================

/**
 * Error codes that the streaming system can handle.
 * Mapped from the protobuf ErrorCode enum for convenience.
 */
export type StreamingErrorCode =
  | "PROJECT_OUT_OF_DATE"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "RATE_LIMITED"
  | "AUTHENTICATION_ERROR"
  | "SERVER_ERROR"
  | "UNKNOWN";

/**
 * Represents a streaming error with additional context.
 */
export interface StreamingError {
  /** Error code for categorization */
  code: StreamingErrorCode;
  /** Human-readable error message */
  message: string;
  /** Original error object if available */
  originalError?: Error | unknown;
  /** Whether this error is retryable */
  retryable: boolean;
  /** Timestamp when the error occurred */
  timestamp: number;
}

/**
 * Recovery strategy types for different error scenarios.
 */
export type RecoveryStrategy =
  | { type: "retry"; maxAttempts: number; backoff: "exponential" | "linear"; delayMs: number }
  | { type: "sync-and-retry"; maxAttempts: number }
  | { type: "show-error"; dismissable: boolean; message?: string }
  | { type: "abort"; cleanup?: boolean };

/**
 * Context provided to the error handler for making recovery decisions.
 */
export interface ErrorContext {
  /** Number of retry attempts already made */
  retryCount: number;
  /** Maximum retries allowed */
  maxRetries: number;
  /** Current prompt being sent */
  currentPrompt: string;
  /** Current selected text */
  currentSelectedText: string;
  /** User ID for logging/analytics */
  userId?: string;
  /** Operation that failed */
  operation: "send-message" | "sync" | "fetch-conversation" | "other";
}

/**
 * Result of error handling - what action was taken.
 */
export interface ErrorResolution {
  /** Whether the error was handled (recovery attempted) */
  handled: boolean;
  /** Whether recovery was successful */
  success: boolean;
  /** Strategy that was applied */
  strategy: RecoveryStrategy;
  /** Additional message for logging/display */
  message?: string;
}
