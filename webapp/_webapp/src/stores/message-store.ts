/**
 * Unified Message Store
 *
 * This store consolidates message state management by combining:
 * - Finalized messages (from conversation-store)
 * - Streaming entries (from streaming-state-machine)
 *
 * Benefits:
 * - Single source of truth for all messages
 * - Unified DisplayMessage type for UI components
 * - No flushSync needed - uses natural React batching
 * - Automatically synced with conversation-store and streaming-state-machine
 *
 * Architecture:
 * - This store subscribes to useConversationStore for finalized messages
 * - This store subscribes to useStreamingStateMachine for streaming entries
 * - UI components only need to use this store for all message rendering
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { Message, Conversation } from "@gen/apiclient/chat/v2/chat_pb";
import { InternalMessage } from "./streaming/types";
import { DisplayMessage } from "./types";
import { fromApiMessage, toDisplayMessage, filterDisplayMessages } from "../utils/message-converters";
import { useConversationStore } from "./conversation/conversation-store";
import { useStreamingStateMachine } from "./streaming";

// ============================================================================
// Store State Interface
// ============================================================================

interface MessageStoreState {
  // Finalized messages from server (synced from conversation-store)
  messages: Message[];

  // Currently streaming entries (synced from streaming-state-machine)
  streamingEntries: InternalMessage[];

  // Conversation metadata (synced from conversation-store)
  conversationId: string;
  modelSlug: string;

  // Computed display messages (updated when messages or streamingEntries change)
  allDisplayMessages: DisplayMessage[];
  visibleDisplayMessages: DisplayMessage[];

  // Flag to track if subscriptions are initialized
  _subscriptionsInitialized: boolean;
}

interface MessageStoreActions {
  // Message management (used by subscriptions)
  setMessages: (messages: Message[]) => void;
  setConversation: (conversation: Conversation) => void;

  // Streaming entry management (used by subscriptions)
  setStreamingEntries: (entries: InternalMessage[]) => void;

  // Initialize subscriptions to source stores
  initializeSubscriptions: () => void;

  // Reset
  reset: () => void;
  resetStreaming: () => void;
}

interface MessageStoreSelectors {
  // Computed selectors
  getAllDisplayMessages: () => DisplayMessage[];
  getVisibleDisplayMessages: () => DisplayMessage[];
  hasStreamingMessages: () => boolean;
  isWaitingForResponse: () => boolean;
  hasStaleMessages: () => boolean;
}

export type MessageStore = MessageStoreState & MessageStoreActions & MessageStoreSelectors;

// ============================================================================
// Initial State
// ============================================================================

const initialState: MessageStoreState = {
  messages: [],
  streamingEntries: [],
  conversationId: "",
  modelSlug: "",
  allDisplayMessages: [],
  visibleDisplayMessages: [],
  _subscriptionsInitialized: false,
};

// ============================================================================
// Helper: Compute Display Messages
// ============================================================================

function computeDisplayMessages(
  messages: Message[],
  streamingEntries: InternalMessage[],
): { all: DisplayMessage[]; visible: DisplayMessage[] } {
  // Convert finalized messages: Message → InternalMessage → DisplayMessage
  const finalizedDisplayMessages = messages
    .map((msg) => {
      const internalMsg = fromApiMessage(msg);
      if (!internalMsg) return null;
      return toDisplayMessage(internalMsg);
    })
    .filter((m): m is DisplayMessage => m !== null);

  // Convert streaming entries: InternalMessage → DisplayMessage
  const streamingDisplayMessages = streamingEntries
    .map(toDisplayMessage)
    .filter((m): m is DisplayMessage => m !== null);

  // Combine: finalized first, then streaming
  const all = [...finalizedDisplayMessages, ...streamingDisplayMessages];
  const visible = filterDisplayMessages(all);

  return { all, visible };
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useMessageStore = create<MessageStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ========================================================================
    // Message Management (synced from conversation-store)
    // ========================================================================

    setMessages: (messages: Message[]) => {
      const { all, visible } = computeDisplayMessages(messages, get().streamingEntries);
      set({
        messages,
        allDisplayMessages: all,
        visibleDisplayMessages: visible,
      });
    },

    setConversation: (conversation: Conversation) => {
      const { all, visible } = computeDisplayMessages(conversation.messages, get().streamingEntries);
      set({
        messages: conversation.messages,
        conversationId: conversation.id,
        modelSlug: conversation.modelSlug,
        allDisplayMessages: all,
        visibleDisplayMessages: visible,
      });
    },

    // ========================================================================
    // Streaming Entry Management (synced from streaming-state-machine)
    // ========================================================================

    setStreamingEntries: (entries: InternalMessage[]) => {
      const { all, visible } = computeDisplayMessages(get().messages, entries);
      set({
        streamingEntries: entries,
        allDisplayMessages: all,
        visibleDisplayMessages: visible,
      });
    },

    // ========================================================================
    // Subscription Initialization
    // ========================================================================

    initializeSubscriptions: () => {
      if (get()._subscriptionsInitialized) return;

      // Subscribe to conversation-store for finalized messages
      useConversationStore.subscribe(
        (state) => state.currentConversation,
        (conversation) => {
          get().setConversation(conversation);
        },
        { fireImmediately: true },
      );

      // Subscribe to streaming-state-machine for streaming entries
      useStreamingStateMachine.subscribe(
        (state) => state.streamingMessage,
        (streamingMessage) => {
          get().setStreamingEntries(streamingMessage.parts);
        },
        { fireImmediately: true },
      );

      set({ _subscriptionsInitialized: true });
    },

    // ========================================================================
    // Reset
    // ========================================================================

    reset: () => {
      set({
        messages: [],
        streamingEntries: [],
        conversationId: "",
        modelSlug: "",
        allDisplayMessages: [],
        visibleDisplayMessages: [],
        // Keep subscriptions initialized
      });
    },

    resetStreaming: () => {
      const { all, visible } = computeDisplayMessages(get().messages, []);
      set({
        streamingEntries: [],
        allDisplayMessages: all,
        visibleDisplayMessages: visible,
      });
    },

    // ========================================================================
    // Computed Selectors (return cached values)
    // ========================================================================

    getAllDisplayMessages: () => {
      return get().allDisplayMessages;
    },

    getVisibleDisplayMessages: () => {
      return get().visibleDisplayMessages;
    },

    hasStreamingMessages: () => {
      return get().streamingEntries.length > 0;
    },

    isWaitingForResponse: () => {
      const state = get();
      const lastStreaming = state.streamingEntries.at(-1);
      const lastFinalized = state.messages.at(-1);

      // Waiting if last streaming entry is a user message
      if (lastStreaming?.role === "user") {
        return true;
      }

      // Waiting if last finalized is user and no streaming entries
      if (lastFinalized?.payload?.messageType.case === "user" && state.streamingEntries.length === 0) {
        return true;
      }

      return false;
    },

    hasStaleMessages: () => {
      return get().streamingEntries.some((entry) => entry.status === "stale");
    },
  })),
);

// ============================================================================
// Convenience Selectors
// ============================================================================

export const selectAllDisplayMessages = (state: MessageStore) => state.allDisplayMessages;

export const selectVisibleDisplayMessages = (state: MessageStore) => state.visibleDisplayMessages;

export const selectHasStreamingMessages = (state: MessageStore) => state.hasStreamingMessages();

export const selectIsWaitingForResponse = (state: MessageStore) => state.isWaitingForResponse();

export const selectHasStaleMessages = (state: MessageStore) => state.hasStaleMessages();

export const selectConversationId = (state: MessageStore) => state.conversationId;

export const selectModelSlug = (state: MessageStore) => state.modelSlug;

// ============================================================================
// Store Initialization
// ============================================================================

/**
 * Initialize the message store subscriptions.
 * This should be called once at app startup to sync the message store
 * with the conversation store and streaming state machine.
 *
 * Can be called multiple times safely - will only initialize once.
 */
export function initializeMessageStore(): void {
  useMessageStore.getState().initializeSubscriptions();
}

// Auto-initialize when this module is first imported
// This ensures subscriptions are set up before any component renders
initializeMessageStore();
