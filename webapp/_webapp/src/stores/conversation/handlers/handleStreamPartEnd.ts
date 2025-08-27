import {
  MessageTypeAssistant,
  MessageTypeToolCall,
  MessageTypeToolCallPrepareArguments,
  StreamPartEnd,
} from "../../../pkg/gen/apiclient/chat/v1/chat_pb";
import { StreamingMessage } from "../../streaming-message-store";
import { logError } from "../../../libs/logger";
import { MessageEntryStatus } from "../types";

export function handleStreamPartEnd(
  partEnd: StreamPartEnd,
  updateStreamingMessage: (updater: (prev: StreamingMessage) => StreamingMessage) => void,
) {
  const role = partEnd.payload?.messageType.case;
  switch (role) {
    case "assistant": {
      updateStreamingMessage((prev) => {
        const newParts = prev.parts.map((part) => {
          if (part.messageId === partEnd.messageId) {
            const assistantMessage = partEnd.payload?.messageType.value as MessageTypeAssistant;
            return {
              ...part,
              status: MessageEntryStatus.FINALIZED,
              assistant: assistantMessage,
            };
          }
          return part;
        });
        return {
          ...prev,
          parts: newParts,
          sequence: prev.sequence + 1,
        };
      });
      break;
    }
    case "toolCallPrepareArguments": {
      updateStreamingMessage((prev) => {
        const newParts = prev.parts.map((part) => {
          if (part.messageId === partEnd.messageId) {
            const toolCallPrepareArguments = partEnd.payload?.messageType.value as MessageTypeToolCallPrepareArguments;
            return {
              ...part,
              status: MessageEntryStatus.FINALIZED,
              toolCallPrepareArguments: toolCallPrepareArguments,
            };
          }
          return part;
        });
        return {
          ...prev,
          parts: newParts,
          sequence: prev.sequence + 1,
        };
      });
      break;
    }
    case "toolCall": {
      updateStreamingMessage((prev) => {
        const newParts = prev.parts.map((part) => {
          const toolCall = partEnd.payload?.messageType.value as MessageTypeToolCall;
          if (part.messageId === partEnd.messageId) {
            return {
              ...part,
              status: MessageEntryStatus.FINALIZED,
              toolCall: toolCall,
            };
          }
          return part;
        });
        return {
          ...prev,
          parts: newParts,
          sequence: prev.sequence + 1,
        };
      });
      break;
    }
    case "system": {
      break;
    }
    case "unknown": {
      break;
    }
    case "user": {
      break;
    }
    default: {
      if (role !== undefined) {
        const _typeCheck: never = role;
        throw new Error("Unexpected response payload: " + _typeCheck);
        // DO NOT delete above line, it is used to check that all cases are handled.
      }
      logError("unknown role in streamPartEnd:", role);
      break;
    }
  }
}
