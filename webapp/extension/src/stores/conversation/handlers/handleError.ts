import { logError } from "../../../libs/logger";
import { useStreamingMessageStore } from "../../streaming-message-store";
import { MessageEntry, MessageEntryStatus } from "../types";

export function handleError(error?: Error) {
  useStreamingMessageStore.getState().updateStreamingMessage((prev) => {
    const newParts = prev.parts.map((part: MessageEntry) => {
      return {
        ...part,
        status: part.status === MessageEntryStatus.PREPARING ? MessageEntryStatus.STALE : part.status,
      };
    });
    return {
      ...prev,
      parts: newParts,
      sequence: prev.sequence + 1,
    };
  });
  logError("handleError", error);
}
