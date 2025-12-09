import {
  MessageTypeAssistant,
  MessageTypeToolCall,
  MessageTypeToolCallPrepareArguments,
  MessageTypeUnknown,
  MessageTypeUser,
} from "../../pkg/gen/apiclient/chat/v1/chat_pb";

export enum MessageEntryStatus {
  PREPARING = "PREPARING",
  FINALIZED = "FINALIZED", // received "part end" or "stream finalization"
  INCOMPLETE = "INCOMPLETE", // received "incomplete indicator"
  STALE = "STALE", // if network shutdown or server crash.
}

export type MessageEntry = {
  messageId: string;
  status: MessageEntryStatus;
  // roles
  user?: MessageTypeUser;
  assistant?: MessageTypeAssistant;
  toolCallPrepareArguments?: MessageTypeToolCallPrepareArguments;
  toolCall?: MessageTypeToolCall;
  unknown?: MessageTypeUnknown;
};
