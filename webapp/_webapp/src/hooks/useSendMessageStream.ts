/**
 * useSendMessageStream Hook
 *
 * A React hook for sending streaming messages in a conversation.
 *
 * This hook has been refactored as part of Phase 5 to:
 * - Focus on orchestration, delegating event handling to the state machine
 * - Use extracted utilities for request building and event mapping
 * - Reduce the number of hook dependencies
 * - Improve testability and maintainability
 *
 * Architecture:
 * ```
 * useSendMessageStream (orchestrator)
 *     │
 *     ├── buildStreamRequest() → Create API request
 *     │
 *     ├── StreamingStateMachine.handleEvent() → Handle stream events
 *     │
 *     └── mapResponseToStreamEvent() → Map API responses to events
 * ```
 *
 * @example
 * ```tsx
 * function ChatInput() {
 *   const { sendMessageStream, isStreaming } = useSendMessageStream();
 *
 *   const handleSend = async () => {
 *     await sendMessageStream(message, selectedText);
 *   };
 * }
 * ```
 */

import { useCallback, useMemo } from "react";
import { createConversationMessageStream } from "../query/api";
import { useConversationStore } from "../stores/conversation/conversation-store";
import { useListConversationsQuery } from "../query";
import { logError, logWarn } from "../libs/logger";
import { useAuthStore } from "../stores/auth-store";
import { useDevtoolStore } from "../stores/devtool-store";
import { useSelectionStore } from "../stores/selection-store";
import { useSettingStore } from "../stores/setting-store";
import { useSync } from "./useSync";
import { useAdapter } from "../adapters";
import { getProjectId } from "../libs/helpers";
import {
  useStreamingStateMachine,
  InternalMessage,
  withStreamingErrorHandler,
} from "../stores/streaming";
import { createUserMessage } from "../types/message";
import { buildStreamRequest, StreamRequestParams } from "../utils/stream-request-builder";
import { mapResponseToStreamEvent } from "../utils/stream-event-mapper";

// ============================================================================
// Types
// ============================================================================

/**
 * Return type for the useSendMessageStream hook.
 */
export interface UseSendMessageStreamResult {
  /** Function to send a message as a stream */
  sendMessageStream: (message: string, selectedText: string, parentMessageId?: string) => Promise<void>;
  /** Whether a stream is currently active */
  isStreaming: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSendMessageStream(): UseSendMessageStreamResult {
  // External dependencies
  const { sync } = useSync();
  const { user } = useAuthStore();
  const adapter = useAdapter();

  // Conversation state
  const currentConversation = useConversationStore((s) => s.currentConversation);
  const projectId = adapter.getDocumentId?.() || getProjectId();
  const { refetch: refetchConversationList } = useListConversationsQuery(projectId);

  // Streaming state machine
  const stateMachine = useStreamingStateMachine();
  const isStreaming = stateMachine.state !== "idle";

  // Selection and settings
  const surroundingText = useSelectionStore((s) => s.surroundingText);
  const alwaysSyncProject = useDevtoolStore((s) => s.alwaysSyncProject);
  const conversationMode = useSettingStore((s) => s.conversationMode);

  /**
   * Add the user message to the streaming state.
   */
  const addUserMessageToStream = useCallback(
    (message: string, selectedText: string) => {
      const newUserMessage: InternalMessage = createUserMessage(
        `pending-${crypto.randomUUID()}`,
        message,
        {
          selectedText,
          surrounding: surroundingText ?? undefined,
          status: "streaming",
        }
      );

      useStreamingStateMachine.setState((state) => ({
        streamingMessage: {
          parts: [...state.streamingMessage.parts, newUserMessage],
          sequence: state.streamingMessage.sequence + 1,
        },
      }));
    },
    [surroundingText]
  );

  /**
   * Truncate conversation for message editing.
   */
  const truncateConversationIfEditing = useCallback(
    (parentMessageId?: string) => {
      if (!parentMessageId || currentConversation.messages.length === 0) return;

      if (parentMessageId === "root") {
        // Clear all messages for "root" edit
        useConversationStore.getState().updateCurrentConversation((prev) => ({
          ...prev,
          messages: [],
        }));
        return;
      }

      const parentIndex = currentConversation.messages.findIndex(
        (m) => m.messageId === parentMessageId
      );

      if (parentIndex !== -1) {
        // Truncate messages to include only up to parentMessage
        useConversationStore.getState().updateCurrentConversation((prev) => ({
          ...prev,
          messages: prev.messages.slice(0, parentIndex + 1),
        }));
      }
    },
    [currentConversation.messages]
  );

  /**
   * Main send message function.
   */
  const sendMessageStream = useCallback(
    async (message: string, selectedText: string, parentMessageId?: string) => {
      // Validate input
      if (!message?.trim()) {
        logWarn("No message to send");
        return;
      }
      message = message.trim();

      // Build request parameters
      const requestParams: StreamRequestParams = {
        message,
        selectedText,
        projectId,
        conversationId: currentConversation.id,
        modelSlug: currentConversation.modelSlug,
        surroundingText: surroundingText ?? undefined,
        conversationMode: conversationMode === "debug" ? "debug" : "default",
        parentMessageId,
      };

      // Build the API request
      const request = buildStreamRequest(requestParams);

      // Reset state machine and prepare for new stream
      stateMachine.reset();
      truncateConversationIfEditing(parentMessageId);
      addUserMessageToStream(message, selectedText);

      // Optional: sync project in dev mode
      if (import.meta.env.DEV && alwaysSyncProject) {
        await sync();
      }

      // Execute the stream with error handling
      await withStreamingErrorHandler(
        () =>
          createConversationMessageStream(request, async (response) => {
            const event = mapResponseToStreamEvent(response);
            if (event) {
              await stateMachine.handleEvent(event, {
                refetchConversationList,
                userId: user?.id || "",
                currentPrompt: message,
                currentSelectedText: selectedText,
                sync: async () => {
                  try {
                    const result = await sync();
                    return result;
                  } catch (e) {
                    logError("Failed to sync project", e);
                    return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
                  }
                },
                sendMessageStream,
              });
            }
          }),
        {
          sync: async () => {
            try {
              const result = await sync();
              return result;
            } catch (e) {
              logError("Failed to sync project", e);
              return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
            }
          },
          onGiveUp: () => {
            stateMachine.handleEvent({
              type: "CONNECTION_ERROR",
              payload: new Error("Connection error"),
            });
          },
          context: {
            currentPrompt: message,
            currentSelectedText: selectedText,
            userId: user?.id,
            operation: "send-message",
          },
        }
      );
    },
    // Reduced dependencies: 5 main dependencies instead of 11
    [
      stateMachine,
      currentConversation,
      projectId,
      refetchConversationList,
      sync,
      // These are derived/stable and won't cause re-renders
      user?.id,
      alwaysSyncProject,
      conversationMode,
      surroundingText,
      addUserMessageToStream,
      truncateConversationIfEditing,
    ]
  );

  return useMemo(
    () => ({ sendMessageStream, isStreaming }),
    [sendMessageStream, isStreaming]
  );
}
