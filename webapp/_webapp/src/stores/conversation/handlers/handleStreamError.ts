import { StreamError } from "../../../pkg/gen/apiclient/chat/v1/chat_pb";
import { errorToast } from "../../../libs/toasts";
import { OverleafAuthentication, OverleafVersionedDoc } from "../../../libs/overleaf-socket";
import { getProjectId } from "../../../libs/helpers";
import { getCookies } from "../../../intermediate";

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
) {
  try {
    const { session, gclb } = await getCookies(window.location.hostname);
    if (streamError.errorMessage.includes("project is out of date")) {
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
      errorToast(streamError.errorMessage, "Chat Error");
    }
  } catch (error) {
    errorToast(error instanceof Error ? error.message : "Unknown error", "Chat Error");
  }
}
