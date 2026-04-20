// ============================================================================
// DisplayMessage Types - Unified message type for UI rendering
// ============================================================================

/**
 * Status of a display message.
 */
export type DisplayMessageStatus = "streaming" | "complete" | "error" | "stale";

/**
 * Type of display message.
 */
export type DisplayMessageType = "user" | "assistant" | "toolCall" | "toolCallPrepare" | "error";

/**
 * Unified message type for UI rendering.
 * All UI components should use this type instead of Message or MessageEntry directly.
 * This provides a single consistent interface regardless of whether the message
 * is finalized or still streaming.
 */
export interface DisplayMessage {
  /** Unique message identifier */
  id: string;

  /** Message type */
  type: DisplayMessageType;

  /** Current status */
  status: DisplayMessageStatus;

  /** Main content (text for user/assistant, empty for tool calls) */
  content: string;

  /** Reasoning content (for assistant messages with thinking) */
  reasoning?: string;

  // Tool call specific fields
  toolName?: string;
  toolArgs?: string;
  toolResult?: string;
  toolError?: string;

  // User message specific fields
  selectedText?: string;
}
