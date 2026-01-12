import { MessageTypeAssistantSchema, StreamError } from "../../../pkg/gen/apiclient/chat/v2/chat_pb";
import { errorToast } from "../../../libs/toasts";
import { StreamingMessage } from "../../streaming-message-store";
import { MessageEntry, MessageEntryStatus } from "../types";
import { fromJson } from "@bufbuild/protobuf";

interface SyncResult {
  success: boolean;
  error?: Error;
}

export async function handleStreamError(
  streamError: StreamError,
  _userId: string, // Kept for API compatibility, sync handles user internally
  currentPrompt: string,
  currentSelectedText: string,
  sync: () => Promise<SyncResult>,
  sendMessageStream: (message: string, selectedText: string) => Promise<void>,
  updateStreamingMessage: (updater: (prev: StreamingMessage) => StreamingMessage) => void,
) {
  // Append an error message to the streaming message
  const updateFunc = (prev: StreamingMessage) => {
    const errorMessageEntry: MessageEntry = {
      messageId: "error-" + Date.now(),
      status: MessageEntryStatus.STALE,
      assistant: fromJson(MessageTypeAssistantSchema, {
        content: `${streamError.errorMessage}`,
      }),
    };
    return {
      ...prev,
      parts: [...prev.parts, errorMessageEntry],
    };
  };

  try {
    if (streamError.errorMessage.includes("project is out of date")) {
      // Platform-aware sync (Overleaf uses WebSocket, Word uses adapter.getFullText)
      const result = await sync();
      if (!result.success) {
        throw result.error || new Error("Sync failed");
      }
      // Retry sending the message after sync
      await sendMessageStream(currentPrompt, currentSelectedText);
    } else {
      updateStreamingMessage(updateFunc);
      errorToast(streamError.errorMessage, "Chat Stream Error");
    }
  } catch (error) {
    updateStreamingMessage(updateFunc);
    errorToast(error instanceof Error ? error.message : "Unknown error", "Chat Stream Error");
  }
}
