/**
 * Types Module
 *
 * Re-exports all public types used throughout the application.
 */

// Internal Message Types (canonical format)
export type {
    InternalMessage,
    UserMessage,
    AssistantMessage,
    ToolCallMessage,
    ToolCallPrepareMessage,
    SystemMessage,
    UnknownMessage,
    MessageStatus,
    MessageRole,
    UserMessageData,
    AssistantMessageData,
    ToolCallData,
    ToolCallPrepareData,
    SystemMessageData,
    UnknownMessageData,
  } from "./message";
  
  // Type Guards
  export {
    isUserMessage,
    isAssistantMessage,
    isToolCallMessage,
    isToolCallPrepareMessage,
    isSystemMessage,
    isUnknownMessage,
  } from "./message";
  
  // Factory Functions
  export {
    createUserMessage,
    createAssistantMessage,
    createToolCallMessage,
    createToolCallPrepareMessage,
  } from "./message";
  