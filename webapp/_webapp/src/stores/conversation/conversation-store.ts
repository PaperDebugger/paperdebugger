import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { Conversation, ConversationSchema } from "@gen/apiclient/chat/v2/chat_pb";
import { fromJson } from "@/libs/protobuf-utils";
import { useConversationUiStore } from "./conversation-ui-store";

interface ConversationStore {
  isStreaming: boolean;
  currentConversation: Conversation;
  setCurrentConversation: (conversation: Conversation) => void;
  updateCurrentConversation: (updater: (conversation: Conversation) => Conversation) => void;
  startFromScratch: () => void;
  setIsStreaming: (isStreaming: boolean) => void;
}

export const useConversationStore = create<ConversationStore>()(
  subscribeWithSelector((set, get) => ({
    currentConversation: newConversation(),
    setCurrentConversation: (conversation: Conversation) => set({ currentConversation: conversation }),
    updateCurrentConversation: (updater: (conversation: Conversation) => Conversation) =>
      set({ currentConversation: updater(get().currentConversation) }),
    startFromScratch: () => set({ currentConversation: newConversation() }),
    isStreaming: false,
    setIsStreaming: (isStreaming: boolean) => set({ isStreaming }),
  })),
);

export function newConversation(): Conversation {
  const modelSlug = useConversationUiStore.getState().lastUsedModelSlug;
  return fromJson(ConversationSchema, {
    id: "",
    modelSlug: modelSlug,
    title: "New Conversation",
    messages: [],
  });
}
