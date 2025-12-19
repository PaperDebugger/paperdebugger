import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Conversation, ConversationSchema } from "../../pkg/gen/apiclient/chat/v2/chat_pb";
import { fromJson } from "@bufbuild/protobuf";
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
  persist(
    (set, get) => ({
      currentConversation: newConversation(),
      setCurrentConversation: (conversation: Conversation) => set({ currentConversation: conversation }),
      updateCurrentConversation: (updater: (conversation: Conversation) => Conversation) =>
        set({ currentConversation: updater(get().currentConversation) }),
      startFromScratch: () => set({ currentConversation: newConversation() }),
      isStreaming: false,
      setIsStreaming: (isStreaming: boolean) => set({ isStreaming }),
    }),
    {
      name: "pd.conversation-storage",
      storage: createJSONStorage(() => localStorage, {
        replacer: (_key, value) => {
          if (typeof value === "bigint") {
            return value.toString() + "n";
          }
          return value;
        },
        reviver: (_key, value) => {
          if (typeof value === "string" && /^-?\d+n$/.test(value)) {
            return BigInt(value.slice(0, -1));
          }
          return value;
        },
      }),
    },
  ),
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
