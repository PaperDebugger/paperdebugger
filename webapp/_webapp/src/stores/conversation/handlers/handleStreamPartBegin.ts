import { StreamPartBegin } from "../../../pkg/gen/apiclient/chat/v1/chat_pb";
import { StreamingMessage } from "../../streaming-message-store";
import { MessageEntry, MessageEntryStatus } from "../types";
import { logError } from "../../../libs/logger";

export function handleStreamPartBegin(
  partBegin: StreamPartBegin,
  updateStreamingMessage: (updater: (prev: StreamingMessage) => StreamingMessage) => void,
) {
  const role = partBegin.payload?.messageType.case;
  if (role === "assistant") {
    const newMessageEntry: MessageEntry = {
      messageId: partBegin.messageId,
      status: MessageEntryStatus.PREPARING,
      assistant: partBegin.payload?.messageType.value,
    };
    updateStreamingMessage((prev) => ({
      parts: [...prev.parts, newMessageEntry],
      sequence: prev.sequence + 1,
    }));
  } else if (role === "toolCallPrepareArguments") {
    const newMessageEntry: MessageEntry = {
      messageId: partBegin.messageId,
      status: MessageEntryStatus.PREPARING,
      toolCallPrepareArguments: partBegin.payload?.messageType.value,
    };
    updateStreamingMessage((prev) => ({
      parts: [...prev.parts, newMessageEntry],
      sequence: prev.sequence + 1,
    }));
  } else if (role === "toolCall") {
    const newMessageEntry: MessageEntry = {
      messageId: partBegin.messageId,
      status: MessageEntryStatus.PREPARING,
      toolCall: partBegin.payload?.messageType.value,
    };
    updateStreamingMessage((prev) => ({
      parts: [...prev.parts, newMessageEntry],
      sequence: prev.sequence + 1,
    }));
  } else if (role === "system") {
    // not possible
  } else if (role === "user") {
    // not possible
  } else if (role === "unknown") {
    // not possible
  } else {
    if (role !== undefined) {
      const _typeCheck: never = role;
      throw new Error("Unexpected response payload: " + _typeCheck);
      // DO NOT delete above line, it is used to check that all cases are handled.
    }
    logError("unknown role in streamPartEnd:", role);
  }
}
