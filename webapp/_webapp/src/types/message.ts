/**
 * Canonical Internal Message Types
 *
 * This file defines the single internal message format used throughout the app.
 * All components should use these types instead of working with protobuf types directly.
 *
 * Data Flow:
 * 1. API Response → InternalMessage (via fromApiMessage)
 * 2. InternalMessage → API Request (via toApiMessage)
 * 3. InternalMessage → DisplayMessage (trivial 1:1 mapping in most cases)
 *
 * Benefits:
 * - Single format reduces confusion
 * - Clear boundary between API types and internal types
 * - Reduces the number of data transformations
 */

// ============================================================================
// Message Status
// ============================================================================

/**
 * Status of a message during its lifecycle.
 * Replaces MessageEntryStatus with clearer semantics.
 */
export type MessageStatus = "streaming" | "complete" | "error" | "stale";

// ============================================================================
// Message Roles
// ============================================================================

/**
 * All possible message roles.
 */
export type MessageRole =
  | "user"
  | "assistant"
  | "toolCall"
  | "toolCallPrepare"
  | "system"
  | "unknown";

// ============================================================================
// Role-Specific Data
// ============================================================================

/**
 * Data specific to user messages.
 */
export interface UserMessageData {
  content: string;
  selectedText?: string;
  surrounding?: string;
}

/**
 * Data specific to assistant messages.
 */
export interface AssistantMessageData {
  content: string;
  reasoning?: string;
  modelSlug?: string;
}

/**
 * Data specific to tool call messages.
 */
export interface ToolCallData {
  name: string;
  args: string;
  result?: string;
  error?: string;
}

/**
 * Data specific to tool call preparation messages.
 */
export interface ToolCallPrepareData {
  name: string;
  args: string;
}

/**
 * Data specific to system messages.
 */
export interface SystemMessageData {
  content: string;
}

/**
 * Data specific to unknown messages.
 */
export interface UnknownMessageData {
  description: string;
}

// ============================================================================
// Internal Message Type
// ============================================================================

/**
 * Base properties shared by all message types.
 */
interface InternalMessageBase {
  /** Unique message identifier */
  id: string;
  /** Current status of the message */
  status: MessageStatus;
  /** Optional timestamp (milliseconds since epoch) */
  timestamp?: number;
}

/**
 * User message.
 */
export interface UserMessage extends InternalMessageBase {
  role: "user";
  data: UserMessageData;
}

/**
 * Assistant message.
 */
export interface AssistantMessage extends InternalMessageBase {
  role: "assistant";
  data: AssistantMessageData;
}

/**
 * Tool call message.
 */
export interface ToolCallMessage extends InternalMessageBase {
  role: "toolCall";
  data: ToolCallData;
}

/**
 * Tool call preparation message.
 */
export interface ToolCallPrepareMessage extends InternalMessageBase {
  role: "toolCallPrepare";
  data: ToolCallPrepareData;
}

/**
 * System message.
 */
export interface SystemMessage extends InternalMessageBase {
  role: "system";
  data: SystemMessageData;
}

/**
 * Unknown message type.
 */
export interface UnknownMessage extends InternalMessageBase {
  role: "unknown";
  data: UnknownMessageData;
}

/**
 * Union type representing all internal message types.
 * This is the canonical format used throughout the application.
 */
export type InternalMessage =
  | UserMessage
  | AssistantMessage
  | ToolCallMessage
  | ToolCallPrepareMessage
  | SystemMessage
  | UnknownMessage;

// ============================================================================
// Type Guards
// ============================================================================

export function isUserMessage(msg: InternalMessage): msg is UserMessage {
  return msg.role === "user";
}

export function isAssistantMessage(msg: InternalMessage): msg is AssistantMessage {
  return msg.role === "assistant";
}

export function isToolCallMessage(msg: InternalMessage): msg is ToolCallMessage {
  return msg.role === "toolCall";
}

export function isToolCallPrepareMessage(msg: InternalMessage): msg is ToolCallPrepareMessage {
  return msg.role === "toolCallPrepare";
}

export function isSystemMessage(msg: InternalMessage): msg is SystemMessage {
  return msg.role === "system";
}

export function isUnknownMessage(msg: InternalMessage): msg is UnknownMessage {
  return msg.role === "unknown";
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new user message.
 */
export function createUserMessage(
  id: string,
  content: string,
  options?: {
    selectedText?: string;
    surrounding?: string;
    status?: MessageStatus;
  }
): UserMessage {
  return {
    id,
    role: "user",
    status: options?.status ?? "streaming",
    data: {
      content,
      selectedText: options?.selectedText,
      surrounding: options?.surrounding,
    },
  };
}

/**
 * Create a new assistant message.
 */
export function createAssistantMessage(
  id: string,
  content: string,
  options?: {
    reasoning?: string;
    modelSlug?: string;
    status?: MessageStatus;
  }
): AssistantMessage {
  return {
    id,
    role: "assistant",
    status: options?.status ?? "streaming",
    data: {
      content,
      reasoning: options?.reasoning,
      modelSlug: options?.modelSlug,
    },
  };
}

/**
 * Create a new tool call message.
 */
export function createToolCallMessage(
  id: string,
  name: string,
  args: string,
  options?: {
    result?: string;
    error?: string;
    status?: MessageStatus;
  }
): ToolCallMessage {
  return {
    id,
    role: "toolCall",
    status: options?.status ?? "streaming",
    data: {
      name,
      args,
      result: options?.result,
      error: options?.error,
    },
  };
}

/**
 * Create a new tool call prepare message.
 */
export function createToolCallPrepareMessage(
  id: string,
  name: string,
  args: string,
  options?: {
    status?: MessageStatus;
  }
): ToolCallPrepareMessage {
  return {
    id,
    role: "toolCallPrepare",
    status: options?.status ?? "streaming",
    data: {
      name,
      args,
    },
  };
}
