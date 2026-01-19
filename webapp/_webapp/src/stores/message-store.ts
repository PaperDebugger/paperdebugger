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
import { Message, Conversation, BranchInfo } from "../pkg/gen/apiclient/chat/v2/chat_pb";
import { MessageEntry, MessageEntryStatus } from "./streaming/types";
import { DisplayMessage } from "./types";
import {
  messageToDisplayMessage,
  messageEntryToDisplayMessage,
  filterDisplayMessages,
} from "./converters";
import { useConversationStore } from "./conversation/conversation-store";
import { useStreamingStateMachine } from "./streaming";

// ============================================================================
// Store State Interface
// ============================================================================

interface MessageStoreState {
  // Finalized messages from server (synced from conversation-store)
  messages: Message[];

  // Currently streaming entries (synced from streaming-state-machine)
  streamingEntries: MessageEntry[];

  // Conversation metadata (synced from conversation-store)
  conversationId: string;
  modelSlug: string;

  // Branch information (synced from conversation-store)
  currentBranchId: string;
  branches: BranchInfo[];
  currentBranchIndex: number;
  totalBranches: number;

  // Flag to track if subscriptions are initialized
  _subscriptionsInitialized: boolean;
}

interface MessageStoreActions {
  // Message management (used by subscriptions)
  setMessages: (messages: Message[]) => void;
  setConversation: (conversation: Conversation) => void;

  // Streaming entry management (used by subscriptions)
  setStreamingEntries: (entries: MessageEntry[]) => void;

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

export type MessageStore = MessageStoreState &
  MessageStoreActions &
  MessageStoreSelectors;

// ============================================================================
// Initial State
// ============================================================================

const initialState: MessageStoreState = {
  messages: [],
  streamingEntries: [],
  conversationId: "",
  modelSlug: "",
  currentBranchId: "",
  branches: [],
  currentBranchIndex: 0,
  totalBranches: 0,
  _subscriptionsInitialized: false,
};

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
      set({ messages });
    },

    setConversation: (conversation: Conversation) => {
      set({
        messages: conversation.messages,
        conversationId: conversation.id,
        modelSlug: conversation.modelSlug,
        currentBranchId: conversation.currentBranchId,
        branches: [...conversation.branches],
        currentBranchIndex: conversation.currentBranchIndex,
        totalBranches: conversation.totalBranches,
      });
    },

    // ========================================================================
    // Streaming Entry Management (synced from streaming-state-machine)
    // ========================================================================

    setStreamingEntries: (entries: MessageEntry[]) => {
      set({ streamingEntries: entries });
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
          set({
            messages: conversation.messages,
            conversationId: conversation.id,
            modelSlug: conversation.modelSlug,
            currentBranchId: conversation.currentBranchId,
            branches: [...conversation.branches],
            currentBranchIndex: conversation.currentBranchIndex,
            totalBranches: conversation.totalBranches,
          });
        },
        { fireImmediately: true }
      );

      // Subscribe to streaming-state-machine for streaming entries
      useStreamingStateMachine.subscribe(
        (state) => state.streamingMessage,
        (streamingMessage) => {
          set({ streamingEntries: streamingMessage.parts });
        },
        { fireImmediately: true }
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
        currentBranchId: "",
        branches: [],
        currentBranchIndex: 0,
        totalBranches: 0,
        // Keep subscriptions initialized
      });
    },

    resetStreaming: () => {
      set({ streamingEntries: [] });
    },

    // ========================================================================
    // Computed Selectors
    // ========================================================================

    getAllDisplayMessages: () => {
      const state = get();

      // Convert finalized messages
      const finalizedDisplayMessages = state.messages
        .map(messageToDisplayMessage)
        .filter((m): m is DisplayMessage => m !== null);

      // Convert streaming entries
      const streamingDisplayMessages = state.streamingEntries
        .map(messageEntryToDisplayMessage)
        .filter((m): m is DisplayMessage => m !== null);

      // Combine: finalized first, then streaming
      return [...finalizedDisplayMessages, ...streamingDisplayMessages];
    },

    getVisibleDisplayMessages: () => {
      return filterDisplayMessages(get().getAllDisplayMessages());
    },

    hasStreamingMessages: () => {
      return get().streamingEntries.length > 0;
    },

    isWaitingForResponse: () => {
      const state = get();
      const lastStreaming = state.streamingEntries.at(-1);
      const lastFinalized = state.messages.at(-1);

      // Waiting if last streaming entry is a user message
      if (lastStreaming?.user !== undefined) {
        return true;
      }

      // Waiting if last finalized is user and no streaming entries
      if (
        lastFinalized?.payload?.messageType.case === "user" &&
        state.streamingEntries.length === 0
      ) {
        return true;
      }

      return false;
    },

    hasStaleMessages: () => {
      return get().streamingEntries.some(
        (entry) => entry.status === MessageEntryStatus.STALE
      );
    },
  }))
);

// ============================================================================
// Convenience Selectors
// ============================================================================

export const selectAllDisplayMessages = (state: MessageStore) =>
  state.getAllDisplayMessages();

export const selectVisibleDisplayMessages = (state: MessageStore) =>
  state.getVisibleDisplayMessages();

export const selectHasStreamingMessages = (state: MessageStore) =>
  state.hasStreamingMessages();

export const selectIsWaitingForResponse = (state: MessageStore) =>
  state.isWaitingForResponse();

export const selectHasStaleMessages = (state: MessageStore) =>
  state.hasStaleMessages();

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
