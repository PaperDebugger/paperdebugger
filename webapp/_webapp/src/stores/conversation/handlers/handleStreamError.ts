import { MessageTypeAssistantSchema, StreamError } from "../../../pkg/gen/apiclient/chat/v2/chat_pb";
import { errorToast } from "../../../libs/toasts";
import { OverleafAuthentication, OverleafVersionedDoc } from "../../../libs/overleaf-socket";
import { getProjectId } from "../../../libs/helpers";
import { getCookies } from "../../../intermediate";
import { StreamingMessage } from "../../streaming-message-store";
import { MessageEntry, MessageEntryStatus } from "../types";
import { fromJson } from "../../../libs/protobuf-utils";

export async function handleStreamError(
  streamError: StreamError,
  userId: string,
  currentPrompt: string,
  currentSelectedText: string,
  sync: (
    userId: string,
    projectId: string,
    overleafAuth: OverleafAuthentication,
    csrfToken: string,
  ) => Promise<Map<string, OverleafVersionedDoc>>,
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
    const { session, gclb } = await getCookies(window.location.hostname);
    if (streamError.errorMessage.includes("project is out of date")) {
      // TODO: replace this into a shared variable for both backend and frontend
      await sync(
        userId,
        getProjectId(),
        {
          cookieOverleafSession2: session,
          cookieGCLB: gclb,
        },
        "unused",
      );
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
