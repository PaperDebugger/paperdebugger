import { useCallback } from "react";
import {
  ConversationType,
  CreateConversationMessageStreamRequest,
  IncompleteIndicator,
  StreamFinalization,
} from "../pkg/gen/apiclient/chat/v1/chat_pb";
import { PlainMessage } from "../query/types";
import { useStreamingMessageStore } from "../stores/streaming-message-store";
import { getProjectId } from "../libs/helpers";
import { withRetrySync } from "../libs/with-retry-sync";
import { createConversationMessageStream } from "../query/api";
import { handleStreamInitialization } from "../stores/conversation/handlers/handleStreamInitialization";
import { handleStreamPartBegin } from "../stores/conversation/handlers/handleStreamPartBegin";
import { handleMessageChunk } from "../stores/conversation/handlers/handleMessageChunk";
import { handleStreamPartEnd } from "../stores/conversation/handlers/handleStreamPartEnd";
import { handleStreamFinalization } from "../stores/conversation/handlers/handleStreamFinalization";
import { handleStreamError } from "../stores/conversation/handlers/handleStreamError";
import {
  MessageChunk,
  MessageTypeUserSchema,
  StreamError,
  StreamInitialization,
  StreamPartBegin,
  StreamPartEnd,
} from "../pkg/gen/apiclient/chat/v1/chat_pb";
import { MessageEntry, MessageEntryStatus } from "../stores/conversation/types";
import { fromJson } from "@bufbuild/protobuf";
import { useConversationStore } from "../stores/conversation/conversation-store";
import { useListConversationsQuery } from "../query";
import { useSocketStore } from "../stores/socket-store";
import { logError, logWarn } from "../libs/logger";
import { handleError } from "../stores/conversation/handlers/handleError";
import { handleIncompleteIndicator } from "../stores/conversation/handlers/handleIncompleteIndicator";
import { useAuthStore } from "../stores/auth-store";
import { useDevtoolStore } from "../stores/devtool-store";
import { getCookies } from "../intermediate";
import { useSettingStore } from "../stores/setting-store";

/**
 * Custom React hook to handle sending a message as a stream in a conversation.
 *
 * This hook manages the process of sending a user message to the backend as a streaming request,
 * handling all intermediate streaming events (initialization, message chunks, part begin/end, finalization, and errors).
 * It updates the relevant stores for streaming and finalized messages, manages conversation state,
 * and ensures proper synchronization with the backend (including Overleaf authentication).
 *
 * Usage:
 *   const { sendMessageStream } = useSendMessageStream();
 *   await sendMessageStream(message, selectedText);
 *
 * @returns {Object} An object containing the sendMessageStream function.
 * @returns {Function} sendMessageStream - Function to send a message as a stream. Accepts (message: string, selectedText: string) and returns a Promise.
 */
export function useSendMessageStream() {
  const { sync } = useSocketStore();
  const { user } = useAuthStore();

  const { currentConversation } = useConversationStore();
  const { refetch: refetchConversationList } = useListConversationsQuery(getProjectId());
  const { resetStreamingMessage, updateStreamingMessage, resetIncompleteIndicator } = useStreamingMessageStore();
  const { alwaysSyncProject } = useDevtoolStore();
  const { conversationMode } = useSettingStore();

  const sendMessageStream = useCallback(
    async (message: string, selectedText: string) => {
      if (!message || !message.trim()) {
        logWarn("No message to send");
        return;
      }
      message = message.trim();

      const request: PlainMessage<CreateConversationMessageStreamRequest> = {
        projectId: getProjectId(),
        conversationId: currentConversation.id,
        languageModel: currentConversation.languageModel,
        userMessage: message,
        userSelectedText: selectedText,
        conversationType: conversationMode === "debug" ? ConversationType.DEBUG : ConversationType.UNSPECIFIED,
      };

      resetStreamingMessage(); // ensure no stale message in the streaming messages
      resetIncompleteIndicator();

      const newMessageEntry: MessageEntry = {
        messageId: "dummy",
        status: MessageEntryStatus.PREPARING,
        user: fromJson(MessageTypeUserSchema, {
          content: message,
          selectedText: selectedText,
        }),
      };
      updateStreamingMessage((prev) => ({
        ...prev,
        parts: [...prev.parts, newMessageEntry],
        sequence: prev.sequence + 1,
      }));

      if (import.meta.env.DEV && alwaysSyncProject) {
        const { session, gclb } = await getCookies(window.location.hostname);
        await sync(
          user?.id || "",
          getProjectId(),
          {
            cookieOverleafSession2: session,
            cookieGCLB: gclb,
          },
          "unused",
        );
      }

      await withRetrySync(
        () =>
          createConversationMessageStream(request, async (response) => {
            switch (response.responsePayload.case) {
              case "streamInitialization": // means the user message is received by the server, can change the status to FINALIZED
                handleStreamInitialization(
                  response.responsePayload.value as StreamInitialization,
                  refetchConversationList,
                );
                break;
              case "streamPartBegin":
                handleStreamPartBegin(response.responsePayload.value as StreamPartBegin, updateStreamingMessage);
                break;
              case "messageChunk":
                handleMessageChunk(response.responsePayload.value as MessageChunk, updateStreamingMessage);
                break;
              case "streamPartEnd":
                handleStreamPartEnd(response.responsePayload.value as StreamPartEnd, updateStreamingMessage);
                break;
              case "streamFinalization":
                handleStreamFinalization(response.responsePayload.value as StreamFinalization);
                break;
              case "streamError":
                await handleStreamError(
                  response.responsePayload.value as StreamError,
                  user?.id || "",
                  message,
                  selectedText,
                  sync,
                  sendMessageStream,
                );
                break;
              case "incompleteIndicator":
                handleIncompleteIndicator(response.responsePayload.value as IncompleteIndicator);
                break;
              default: {
                if (response.responsePayload.value !== undefined) {
                  const _typeCheck: never = response.responsePayload;
                  throw new Error("Unexpected response payload: " + _typeCheck);
                  // DO NOT delete above line, it is used to check that all cases are handled.
                }
                break;
              }
            }
          }),
        {
          sync: async () => {
            try {
              const { session, gclb } = await getCookies(window.location.hostname);
              await sync(
                user?.id || "",
                getProjectId(),
                {
                  cookieOverleafSession2: session,
                  cookieGCLB: gclb,
                },
                "unused",
              );
            } catch (e) {
              logError("Failed to sync project", e);
            }
          },
          onGiveUp: () => {
            handleError(new Error("connection error."));
          },
        },
      );
    },
    [
      resetStreamingMessage,
      resetIncompleteIndicator,
      updateStreamingMessage,
      currentConversation,
      refetchConversationList,
      sync,
      user?.id,
      alwaysSyncProject,
      conversationMode,
    ],
  );

  return { sendMessageStream };
}
