export type Setter<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

export type Resetter<T> = {
  [K in keyof T as `reset${Capitalize<string & K>}`]: () => void;
};

export type Updater<T> = {
  [K in keyof T as `update${Capitalize<string & K>}`]: (updater: (prev: T[K]) => T[K]) => void;
};

export type SetterResetterStore<T> = T & Setter<T> & Resetter<T> & Updater<T>;
export type SetterStore<T> = T & Setter<T>;

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
  
  /** ID of the previous message (for branching) */
  previousMessageId?: string;
}
