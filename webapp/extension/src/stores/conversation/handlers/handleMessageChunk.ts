import { logError } from "../../../libs/logger";
import { MessageChunk, MessageTypeAssistant } from "../../../pkg/gen/apiclient/chat/v1/chat_pb";
import { StreamingMessage } from "../../streaming-message-store";
import { MessageEntry, MessageEntryStatus } from "../types";

export function handleMessageChunk(
  chunk: MessageChunk,
  updateStreamingMessage: (updater: (prev: StreamingMessage) => StreamingMessage) => void,
) {
  updateStreamingMessage((prevMessage) => {
    const updatedParts = prevMessage.parts.map((part: MessageEntry) => {
      const isTargetPart = part.messageId === chunk.messageId && part.assistant;

      if (!isTargetPart) return part;

      const updatedAssistant: MessageTypeAssistant = {
        ...part.assistant!,
        content: part.assistant!.content + chunk.delta,
      };

      if (part.status !== MessageEntryStatus.PREPARING) {
        logError("Message chunk received for non-preparing part, this is a critical error");
      }

      return {
        ...part,
        assistant: updatedAssistant,
      };
    });

    return {
      ...prevMessage,
      parts: updatedParts,
      sequence: prevMessage.sequence + 1,
    };
  });
}
