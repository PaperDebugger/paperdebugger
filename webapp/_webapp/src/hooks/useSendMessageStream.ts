import { useCallback } from "react";
import {
  ConversationType,
  CreateConversationMessageStreamRequest,
  CreateConversationMessageStreamResponse,
  IncompleteIndicator,
  MessageChunk,
  MessageTypeUserSchema,
  ReasoningChunk,
  StreamError,
  StreamFinalization,
  StreamInitialization,
  StreamPartBegin,
  StreamPartEnd,
} from "../pkg/gen/apiclient/chat/v2/chat_pb";
import { PlainMessage } from "../query/types";
import { getProjectId } from "../libs/helpers";
import { withRetrySync } from "../libs/with-retry-sync";
import { createConversationMessageStream } from "../query/api";
import { fromJson } from "../libs/protobuf-utils";
import { useConversationStore } from "../stores/conversation/conversation-store";
import { useListConversationsQuery } from "../query";
import { logError, logWarn } from "../libs/logger";
import { useAuthStore } from "../stores/auth-store";
import { useDevtoolStore } from "../stores/devtool-store";
import { useSelectionStore } from "../stores/selection-store";
import { useSettingStore } from "../stores/setting-store";
import { useSync } from "./useSync";
import { useAdapter } from "../adapters";
import {
  useStreamingStateMachine,
  MessageEntryStatus,
  StreamEvent,
  MessageEntry,
} from "../stores/streaming";

/**
 * Custom React hook to handle sending a message as a stream in a conversation.
 *
 * This hook manages the process of sending a user message to the backend as a streaming request,
 * using the StreamingStateMachine to handle all intermediate streaming events.
 *
 * The hook focuses on orchestration while the state machine handles event processing,
 * making the code easier to understand and maintain.
 *
 * Usage:
 *   const { sendMessageStream } = useSendMessageStream();
 *   await sendMessageStream(message, selectedText);
 *
 * @returns {Object} An object containing the sendMessageStream function.
 * @returns {Function} sendMessageStream - Function to send a message as a stream.
 */
export function useSendMessageStream() {
  const { sync } = useSync();
  const { user } = useAuthStore();
  const adapter = useAdapter();

  const { currentConversation } = useConversationStore();
  // Get project ID from adapter (supports both Overleaf URL and Word document ID)
  const projectId = adapter.getDocumentId?.() || getProjectId();
  const { refetch: refetchConversationList } = useListConversationsQuery(projectId);

  // Use the new streaming state machine
  const { handleEvent, reset: resetStateMachine } = useStreamingStateMachine();

  const { surroundingText: storeSurroundingText } = useSelectionStore();
  const { alwaysSyncProject } = useDevtoolStore();
  const { conversationMode } = useSettingStore();

  const sendMessageStream = useCallback(
    async (message: string, selectedText: string, parentMessageId?: string) => {
      if (!message || !message.trim()) {
        logWarn("No message to send");
        return;
      }
      message = message.trim();

      const request: PlainMessage<CreateConversationMessageStreamRequest> = {
        projectId: projectId,
        conversationId: currentConversation.id,
        modelSlug: currentConversation.modelSlug,
        userMessage: message,
        userSelectedText: selectedText,
        surrounding: storeSurroundingText ?? undefined,
        conversationType:
          conversationMode === "debug" ? ConversationType.DEBUG : ConversationType.UNSPECIFIED,
        parentMessageId,
      };

      // Reset the state machine to ensure no stale messages
      resetStateMachine();

      // When editing a message (parentMessageId is provided), truncate the conversation
      // to only include messages up to and including the parent message
      if (parentMessageId && currentConversation.messages.length > 0) {
        const parentIndex = currentConversation.messages.findIndex(
          (m) => m.messageId === parentMessageId,
        );
        if (parentIndex !== -1) {
          // Truncate messages to include only up to parentMessage
          useConversationStore.getState().updateCurrentConversation((prev) => ({
            ...prev,
            messages: prev.messages.slice(0, parentIndex + 1),
          }));
        } else if (parentMessageId === "root") {
          // Clear all messages for "root" edit
          useConversationStore.getState().updateCurrentConversation((prev) => ({
            ...prev,
            messages: [],
          }));
        }
      }

      // Add the user message to the streaming state
      const newMessageEntry: MessageEntry = {
        messageId: "dummy",
        status: MessageEntryStatus.PREPARING,
        user: fromJson(MessageTypeUserSchema, {
          content: message,
          selectedText: selectedText,
          surrounding: storeSurroundingText ?? null,
        }),
      };

      // Directly update the state machine's streaming message
      useStreamingStateMachine.setState((state) => ({
        streamingMessage: {
          parts: [...state.streamingMessage.parts, newMessageEntry],
          sequence: state.streamingMessage.sequence + 1,
        },
      }));

      if (import.meta.env.DEV && alwaysSyncProject) {
        // Platform-aware sync (Overleaf uses WebSocket, Word uses adapter.getFullText)
        await sync();
      }

      // Handler context for error recovery
      const handlerContext = {
        refetchConversationList,
        userId: user?.id || "",
        currentPrompt: message,
        currentSelectedText: selectedText,
        sync,
        sendMessageStream,
      };

      await withRetrySync(
        () =>
          createConversationMessageStream(request, async (response) => {
            // Map response payload to StreamEvent and delegate to state machine
            const event = mapResponseToEvent(response);
            if (event) {
              await handleEvent(event, handlerContext);
            }
          }),
        {
          sync: async () => {
            try {
              const result = await sync();
              if (!result.success) {
                logError("Failed to sync project", result.error);
              }
            } catch (e) {
              logError("Failed to sync project", e);
            }
          },
          onGiveUp: () => {
            handleEvent({ type: "CONNECTION_ERROR", payload: new Error("connection error.") });
          },
        },
      );
    },
    [
      resetStateMachine,
      handleEvent,
      currentConversation,
      refetchConversationList,
      sync,
      user?.id,
      alwaysSyncProject,
      conversationMode,
      storeSurroundingText,
      projectId,
    ],
  );

  return { sendMessageStream };
}

/**
 * Maps the API response payload to a StreamEvent for the state machine.
 */
function mapResponseToEvent(
  response: CreateConversationMessageStreamResponse,
): StreamEvent | null {
  const { case: payloadCase, value } = response.responsePayload;

  switch (payloadCase) {
    case "streamInitialization":
      return { type: "INIT", payload: value as StreamInitialization };
    case "streamPartBegin":
      return { type: "PART_BEGIN", payload: value as StreamPartBegin };
    case "messageChunk":
      return { type: "CHUNK", payload: value as MessageChunk };
    case "reasoningChunk":
      return { type: "REASONING_CHUNK", payload: value as ReasoningChunk };
    case "streamPartEnd":
      return { type: "PART_END", payload: value as StreamPartEnd };
    case "streamFinalization":
      return { type: "FINALIZE", payload: value as StreamFinalization };
    case "streamError":
      return { type: "ERROR", payload: value as StreamError };
    case "incompleteIndicator":
      return { type: "INCOMPLETE", payload: value as IncompleteIndicator };
    default:
      if (value !== undefined) {
        logError("Unexpected response payload:", response.responsePayload);
      }
      return null;
  }
}
