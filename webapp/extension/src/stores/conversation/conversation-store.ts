import { create } from "zustand";
import { Conversation, ConversationSchema, LanguageModel } from "../../pkg/gen/apiclient/chat/v1/chat_pb";
import { fromJson } from "@bufbuild/protobuf";

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
  return fromJson(ConversationSchema, {
    id: "",
    languageModel: LanguageModel.OPENAI_GPT41,
    title: "New Conversation",
    messages: [],
  });
}
