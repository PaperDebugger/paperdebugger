import { create } from "zustand";
import { Conversation, ConversationSchema } from "../../pkg/gen/apiclient/chat/v2/chat_pb";
import { fromJson } from "@bufbuild/protobuf";
import { getLocalStorage } from "./conversation-ui-store";

interface ConversationStore {
  isStreaming: boolean;
  currentConversation: Conversation;
  setCurrentConversation: (conversation: Conversation) => void;
  updateCurrentConversation: (updater: (conversation: Conversation) => Conversation) => void;
  startFromScratch: () => void;
  setIsStreaming: (isStreaming: boolean) => void;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  currentConversation: newConversation(),
  setCurrentConversation: (conversation: Conversation) => set({ currentConversation: conversation }),
  updateCurrentConversation: (updater: (conversation: Conversation) => Conversation) =>
    set({ currentConversation: updater(get().currentConversation) }),
  startFromScratch: () => set({ currentConversation: newConversation() }),
  isStreaming: false,
  setIsStreaming: (isStreaming: boolean) => set({ isStreaming }),
}));

export function newConversation(): Conversation {
  const lastUsedModelSlug = getLocalStorage<string>("lastUsedModelSlug") || "gpt-4.1";

  return fromJson(ConversationSchema, {
    id: "",
    modelSlug: lastUsedModelSlug,
    title: "New Conversation",
    messages: [],
  });
}
