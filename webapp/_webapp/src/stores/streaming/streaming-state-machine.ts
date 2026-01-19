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
import { flushSync } from "react-dom";
import {
  IncompleteIndicator,
  Message,
  MessageSchema,
  MessageTypeAssistant,
  MessageTypeAssistantSchema,
  Conversation,
} from "../../pkg/gen/apiclient/chat/v2/chat_pb";
import { fromJson } from "../../libs/protobuf-utils";
import { logError, logWarn } from "../../libs/logger";
import { errorToast } from "../../libs/toasts";
import { useConversationStore } from "../conversation/conversation-store";
import { getConversation } from "../../query/api";
import { getMessageTypeHandler, isValidMessageRole } from "./message-type-handlers";
import {
  MessageEntry,
  MessageEntryStatus,
  MessageRole,
  StreamEvent,
  StreamHandlerContext,
  StreamingMessage,
  StreamState,
} from "./types";

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
 * Convert a MessageEntry to a Message for the conversation store.
 */
function convertMessageEntryToMessage(messageEntry: MessageEntry): Message | undefined {
  if (messageEntry.assistant) {
    const assistantPayload: { content: string; reasoning?: string } = {
      content: messageEntry.assistant.content,
    };
    if (messageEntry.assistant.reasoning) {
      assistantPayload.reasoning = messageEntry.assistant.reasoning;
    }
    return fromJson(MessageSchema, {
      messageId: messageEntry.messageId,
      payload: {
        assistant: assistantPayload,
      },
    });
  } else if (messageEntry.toolCall) {
    return fromJson(MessageSchema, {
      messageId: messageEntry.messageId,
      payload: {
        toolCall: {
          name: messageEntry.toolCall.name,
          args: messageEntry.toolCall.args,
          result: messageEntry.toolCall.result,
          error: messageEntry.toolCall.error,
        },
      },
    });
  } else if (messageEntry.user) {
    return fromJson(MessageSchema, {
      messageId: messageEntry.messageId,
      payload: {
        user: {
          content: messageEntry.user.content,
          selectedText: messageEntry.user.selectedText ?? "",
        },
      },
    });
  }
  return undefined;
}

/**
 * Flush finalized streaming messages to the conversation store.
 */
function flushStreamingMessageToConversation(
  streamingMessage: StreamingMessage,
  conversationId?: string,
  modelSlug?: string,
) {
  const flushMessages = streamingMessage.parts
    .filter((part) => part.status === MessageEntryStatus.FINALIZED)
    .map((part) => convertMessageEntryToMessage(part))
    .filter((part): part is Message => part !== null && part !== undefined);

  flushSync(() => {
    useConversationStore.getState().updateCurrentConversation((prev: Conversation) => ({
      ...prev,
      id: conversationId ?? prev.id,
      modelSlug: modelSlug ?? prev.modelSlug,
      messages: [...prev.messages, ...flushMessages],
    }));
  });

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

export const useStreamingStateMachine = create<StreamingStateMachineState>((set, get) => ({
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
              if (part.status === MessageEntryStatus.PREPARING && part.user) {
                return { ...part, status: MessageEntryStatus.FINALIZED };
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
        const newEntry = handler.onPartBegin(event.payload);

        if (newEntry) {
          // Use flushSync to force synchronous update
          flushSync(() => {
            set((state) => {
              // Skip if entry with same messageId already exists
              if (state.streamingMessage.parts.some((p) => p.messageId === newEntry.messageId)) {
                return state;
              }
              return {
                state: "receiving",
                streamingMessage: {
                  parts: [...state.streamingMessage.parts, newEntry],
                  sequence: state.streamingMessage.sequence + 1,
                },
              };
            });
          });
        }
        break;
      }

      // ========================================================================
      // CHUNK - Message content chunk received
      // ========================================================================
      case "CHUNK": {
        flushSync(() => {
          set((state) => {
            const updatedParts = state.streamingMessage.parts.map((part) => {
              const isTargetPart =
                part.messageId === event.payload.messageId && part.assistant;

              if (!isTargetPart) return part;

              if (part.status !== MessageEntryStatus.PREPARING) {
                logError("Message chunk received for non-preparing part");
              }

              const updatedAssistant: MessageTypeAssistant = {
                ...part.assistant!,
                content: part.assistant!.content + event.payload.delta,
              };

              return { ...part, assistant: updatedAssistant };
            });

            return {
              streamingMessage: {
                parts: updatedParts,
                sequence: state.streamingMessage.sequence + 1,
              },
            };
          });
        });
        break;
      }

      // ========================================================================
      // REASONING_CHUNK - Reasoning content chunk received
      // ========================================================================
      case "REASONING_CHUNK": {
        flushSync(() => {
          set((state) => {
            const updatedParts = state.streamingMessage.parts.map((part) => {
              const isTargetPart =
                part.messageId === event.payload.messageId && part.assistant;

              if (!isTargetPart) return part;

              if (part.status !== MessageEntryStatus.PREPARING) {
                logError("Reasoning chunk received for non-preparing part");
              }

              const currentReasoning = part.assistant!.reasoning ?? "";
              const updatedAssistant: MessageTypeAssistant = {
                ...part.assistant!,
                reasoning: currentReasoning + event.payload.delta,
              };

              return { ...part, assistant: updatedAssistant };
            });

            return {
              streamingMessage: {
                parts: updatedParts,
                sequence: state.streamingMessage.sequence + 1,
              },
            };
          });
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

        flushSync(() => {
          set((state) => {
            const updatedParts = state.streamingMessage.parts.map((part) => {
              if (part.messageId !== event.payload.messageId) {
                return part;
              }

              const updates = handler.onPartEnd(event.payload, part);
              if (!updates) return part;

              return { ...part, ...updates };
            });

            return {
              streamingMessage: {
                parts: updatedParts,
                sequence: state.streamingMessage.sequence + 1,
              },
            };
          });
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

        // Check if this is a retryable "project out of date" error
        if (
          errorMessage.includes("project is out of date") &&
          context?.sync &&
          context?.sendMessageStream &&
          context?.currentPrompt !== undefined &&
          context?.currentSelectedText !== undefined
        ) {
          try {
            const result = await context.sync();
            if (!result.success) {
              throw result.error || new Error("Sync failed");
            }
            // Retry sending the message after sync
            await context.sendMessageStream(context.currentPrompt, context.currentSelectedText);
            return;
          } catch {
            // Fall through to error handling
          }
        }

        // Add error message to streaming parts
        const errorEntry: MessageEntry = {
          messageId: "error-" + Date.now(),
          status: MessageEntryStatus.STALE,
          assistant: fromJson(MessageTypeAssistantSchema, {
            content: errorMessage,
          }),
        };

        flushSync(() => {
          set((state) => ({
            state: "error",
            streamingMessage: {
              ...state.streamingMessage,
              parts: [...state.streamingMessage.parts, errorEntry],
            },
          }));
        });

        errorToast(errorMessage, "Chat Stream Error");
        break;
      }

      // ========================================================================
      // CONNECTION_ERROR - Network/connection error
      // ========================================================================
      case "CONNECTION_ERROR": {
        // Mark all preparing messages as stale
        flushSync(() => {
          set((state) => ({
            state: "error",
            streamingMessage: {
              parts: state.streamingMessage.parts.map((part) => ({
                ...part,
                status:
                  part.status === MessageEntryStatus.PREPARING
                    ? MessageEntryStatus.STALE
                    : part.status,
              })),
              sequence: state.streamingMessage.sequence + 1,
            },
          }));
        });

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
}));

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
