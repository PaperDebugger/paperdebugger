/**
 * Streaming State Machine
 *
 * This module consolidates all streaming event handling into a single cohesive state machine,
 * replacing the 9+ fragmented handler files with a centralized, type-safe implementation.
 *
 * Benefits:
 * - Single point of control for all state transitions
 * - Clear state machine pattern with explicit states
 * - Type-safe event handling with exhaustive checking
 * - All related logic in one place for easier debugging
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  IncompleteIndicator,
  Message,
  Conversation,
} from "../../pkg/gen/apiclient/chat/v2/chat_pb";
import { logError, logWarn } from "../../libs/logger";
import { useConversationStore } from "../conversation/conversation-store";
import { createStreamingError, getRecoveryStrategy, StreamingErrorHandler } from "./error-handler";
import { getConversation } from "../../query/api";
import { getMessageTypeHandler, isValidMessageRole } from "./message-type-handlers";
import {
  InternalMessage,
  MessageRole,
  StreamEvent,
  StreamHandlerContext,
  StreamingMessage,
  StreamState,
} from "./types";
import { toApiMessage, createAssistantMessage } from "../../utils/message-converters";

// ============================================================================
// Store State Interface
// ============================================================================

interface StreamingStateMachineState {
  // Current streaming state
  state: StreamState;

  // Streaming message data
  streamingMessage: StreamingMessage;

  // Incomplete indicator from server
  incompleteIndicator: IncompleteIndicator | null;

  // Actions
  handleEvent: (event: StreamEvent, context?: Partial<StreamHandlerContext>) => Promise<void>;
  reset: () => void;
  getStreamingMessage: () => StreamingMessage;
  getIncompleteIndicator: () => IncompleteIndicator | null;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  state: "idle" as StreamState,
  streamingMessage: { parts: [], sequence: 0 },
  incompleteIndicator: null,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Flush finalized streaming messages to the conversation store.
 */
function flushStreamingMessageToConversation(
  streamingMessage: StreamingMessage,
  conversationId?: string,
  modelSlug?: string,
) {
  const flushMessages = streamingMessage.parts
    .filter((part) => part.status === "complete")
    .map((part) => toApiMessage(part))
    .filter((part): part is Message => part !== null && part !== undefined);

  useConversationStore.getState().updateCurrentConversation((prev: Conversation) => ({
    ...prev,
    id: conversationId ?? prev.id,
    modelSlug: modelSlug ?? prev.modelSlug,
    messages: [...prev.messages, ...flushMessages],
  }));

  // Async update branch info (doesn't block, doesn't overwrite messages)
  if (conversationId) {
    updateBranchInfoAsync(conversationId);
  }
}

/**
 * Fetch branch info from server and update only branch-related fields.
 */
async function updateBranchInfoAsync(conversationId: string) {
  try {
    const response = await getConversation({ conversationId });
    if (response.conversation) {
      const branchInfo = response.conversation;
      useConversationStore.getState().updateCurrentConversation((prev: Conversation) => {
        if (prev.id !== conversationId) {
          return prev;
        }
        return {
          ...prev,
          currentBranchId: branchInfo.currentBranchId,
          branches: branchInfo.branches,
          currentBranchIndex: branchInfo.currentBranchIndex,
          totalBranches: branchInfo.totalBranches,
        };
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to update branch info:", error);
  }
}

// ============================================================================
// State Machine Store
// ============================================================================

export const useStreamingStateMachine = create<StreamingStateMachineState>()(
  subscribeWithSelector((set, get) => ({
  ...initialState,

  handleEvent: async (event: StreamEvent, context?: Partial<StreamHandlerContext>) => {
    switch (event.type) {
      // ========================================================================
      // INIT - User message acknowledged by server
      // ========================================================================
      case "INIT": {
        // Finalize the user message (mark as received by server)
        set((state) => ({
          state: "receiving",
          streamingMessage: {
            ...state.streamingMessage,
            parts: state.streamingMessage.parts.map((part) => {
              if (part.status === "streaming" && part.role === "user") {
                return { ...part, status: "complete" as const };
              }
              return part;
            }),
          },
        }));

        if (get().streamingMessage.parts.length !== 1) {
          logWarn("Streaming message parts length is not 1, this may indicate stale messages");
        }

        // Flush to conversation store
        flushStreamingMessageToConversation(
          get().streamingMessage,
          event.payload.conversationId,
          event.payload.modelSlug,
        );

        // Reset after flush
        set({ streamingMessage: { parts: [], sequence: 0 } });

        // Refetch conversation list
        context?.refetchConversationList?.();
        break;
      }

      // ========================================================================
      // PART_BEGIN - New message part started
      // ========================================================================
      case "PART_BEGIN": {
        const role = event.payload.payload?.messageType.case as MessageRole | undefined;

        if (!role || !isValidMessageRole(role)) {
          logError("Unknown role in streamPartBegin:", role);
          break;
        }

        const handler = getMessageTypeHandler(role);
        const newMessage = handler.onPartBegin(event.payload);

        if (newMessage) {
          set((state) => {
            // Skip if entry with same id already exists
            if (state.streamingMessage.parts.some((p) => p.id === newMessage.id)) {
              return state;
            }
            return {
              state: "receiving",
              streamingMessage: {
                parts: [...state.streamingMessage.parts, newMessage],
                sequence: state.streamingMessage.sequence + 1,
              },
            };
          });
        }
        break;
      }

      // ========================================================================
      // CHUNK - Message content chunk received
      // ========================================================================
      case "CHUNK": {
        set((state) => {
          const updatedParts = state.streamingMessage.parts.map((part) => {
            const isTargetPart =
              part.id === event.payload.messageId && part.role === "assistant";

            if (!isTargetPart) return part;

            if (part.status !== "streaming") {
              logError("Message chunk received for non-streaming part");
            }

            if (part.role !== "assistant") return part;

            return {
              ...part,
              data: {
                ...part.data,
                content: part.data.content + event.payload.delta,
              },
            };
          });

          return {
            streamingMessage: {
              parts: updatedParts,
              sequence: state.streamingMessage.sequence + 1,
            },
          };
        });
        break;
      }

      // ========================================================================
      // REASONING_CHUNK - Reasoning content chunk received
      // ========================================================================
      case "REASONING_CHUNK": {
        set((state) => {
          const updatedParts = state.streamingMessage.parts.map((part) => {
            const isTargetPart =
              part.id === event.payload.messageId && part.role === "assistant";

            if (!isTargetPart) return part;

            if (part.status !== "streaming") {
              logError("Reasoning chunk received for non-streaming part");
            }

            if (part.role !== "assistant") return part;

            const currentReasoning = part.data.reasoning ?? "";
            return {
              ...part,
              data: {
                ...part.data,
                reasoning: currentReasoning + event.payload.delta,
              },
            };
          });

          return {
            streamingMessage: {
              parts: updatedParts,
              sequence: state.streamingMessage.sequence + 1,
            },
          };
        });
        break;
      }

      // ========================================================================
      // PART_END - Message part completed
      // ========================================================================
      case "PART_END": {
        const role = event.payload.payload?.messageType.case as MessageRole | undefined;

        if (!role || !isValidMessageRole(role)) {
          logError("Unknown role in streamPartEnd:", role);
          break;
        }

        const handler = getMessageTypeHandler(role);

        set((state) => {
          const updatedParts = state.streamingMessage.parts.map((part) => {
            if (part.id !== event.payload.messageId) {
              return part;
            }

            const updatedMessage = handler.onPartEnd(event.payload, part);
            if (!updatedMessage) return part;

            return updatedMessage;
          });

          return {
            streamingMessage: {
              parts: updatedParts,
              sequence: state.streamingMessage.sequence + 1,
            },
          };
        });
        break;
      }

      // ========================================================================
      // FINALIZE - Stream completed
      // ========================================================================
      case "FINALIZE": {
        set({ state: "finalizing" });

        // Flush remaining messages to conversation store
        flushStreamingMessageToConversation(get().streamingMessage, event.payload.conversationId);

        // Reset streaming state
        set({
          state: "idle",
          streamingMessage: { parts: [], sequence: 0 },
        });
        break;
      }

      // ========================================================================
      // ERROR - Stream error from server
      // ========================================================================
      case "ERROR": {
        const errorMessage = event.payload.errorMessage;
        const streamingError = createStreamingError(errorMessage);
        const strategy = getRecoveryStrategy(streamingError);

        // Check if this error can be recovered with sync-and-retry
        if (
          streamingError.retryable &&
          strategy.type === "sync-and-retry" &&
          context?.sync &&
          context?.sendMessageStream &&
          context?.currentPrompt !== undefined &&
          context?.currentSelectedText !== undefined
        ) {
          const currentPrompt = context.currentPrompt;
          const currentSelectedText = context.currentSelectedText;
          const sendMessageStream = context.sendMessageStream;
          
          const handler = new StreamingErrorHandler({
            sync: context.sync,
            retryOperation: () => sendMessageStream(currentPrompt, currentSelectedText),
          });

          const resolution = await handler.handle(errorMessage, {
            retryCount: 0,
            maxRetries: strategy.maxRetries || 2,  // Use strategy's maxRetries to prevent infinite retry
            currentPrompt: context.currentPrompt,
            currentSelectedText: context.currentSelectedText,
            userId: context.userId,
            operation: "send-message",
          });

          if (resolution.success) {
            return; // Successfully recovered
          }
          // Fall through to error state if recovery failed
        }

        // Add error message to streaming parts
        const errorEntry: InternalMessage = createAssistantMessage(
          "error-" + Date.now(),
          errorMessage,
          { status: "stale" }
        );

        set((state) => ({
          state: "error",
          streamingMessage: {
            ...state.streamingMessage,
            parts: [...state.streamingMessage.parts, errorEntry],
          },
        }));

        // Error handler already shows toast if needed, but show one for non-retryable errors
        if (!streamingError.retryable) {
          // Error is already handled by StreamingErrorHandler which shows toast
        }
        break;
      }

      // ========================================================================
      // CONNECTION_ERROR - Network/connection error
      // ========================================================================
      case "CONNECTION_ERROR": {
        // Mark all streaming messages as stale
        set((state) => ({
          state: "error",
          streamingMessage: {
            parts: state.streamingMessage.parts.map((part) => ({
              ...part,
              status: part.status === "streaming" ? "stale" as const : part.status,
            })),
            sequence: state.streamingMessage.sequence + 1,
          },
        }));

        logError("Connection error:", event.payload);
        break;
      }

      // ========================================================================
      // INCOMPLETE - Incomplete indicator received
      // ========================================================================
      case "INCOMPLETE": {
        set({ incompleteIndicator: event.payload });
        break;
      }

      default: {
        // Exhaustive type checking
        const _exhaustive: never = event;
        logError("Unhandled event type:", _exhaustive);
      }
    }
  },

  reset: () => {
    set(initialState);
  },

  getStreamingMessage: () => get().streamingMessage,

  getIncompleteIndicator: () => get().incompleteIndicator,
}))
);

// ============================================================================
// Convenience Selectors
// ============================================================================

/**
 * Select the streaming message from the state machine.
 */
export const selectStreamingMessage = (state: StreamingStateMachineState) => state.streamingMessage;

/**
 * Select the incomplete indicator from the state machine.
 */
export const selectIncompleteIndicator = (state: StreamingStateMachineState) =>
  state.incompleteIndicator;

/**
 * Select the current stream state.
 */
export const selectStreamState = (state: StreamingStateMachineState) => state.state;
