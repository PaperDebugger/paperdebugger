import { TabHeader } from "../../../components/tab-header";
import { ChatButton } from "./chat-button";
import { useConversationStore } from "../../../stores/conversation/conversation-store";
import { useStreamingStateMachine } from "../../../stores/streaming";
import { useConversationUiStore } from "../../../stores/conversation/conversation-ui-store";
import { ChatHistoryModal } from "./chat-history-modal";
import { BranchSwitcher } from "../../../components/branch-switcher";

export const NewConversation = () => {
  useStreamingStateMachine.getState().reset();
  useConversationStore.getState().setIsStreaming(false);
  useConversationStore.getState().startFromScratch();
  useConversationUiStore.getState().inputRef?.current?.focus();
};

export const ShowHistory = () => {
  useConversationUiStore.getState().setShowChatHistory(true);
};


export const ChatHeader = () => {
  const currentConversation = useConversationStore((s) => s.currentConversation);
  const showChatHistory = useConversationUiStore((s) => s.showChatHistory);
  const title = currentConversation?.title ?? "New Conversation";
  return (
    <TabHeader
      title={title}
      actions={
        <>
          <BranchSwitcher conversation={currentConversation} />
          <ChatButton
            icon="tabler:plus"
            alt="New Conversation"
            onClick={NewConversation}
            tooltip="New Conversation"
            disableAnimation
          />
          <ChatButton
            icon="tabler:history"
            alt="Conversation History"
            onClick={ShowHistory}
            tooltip="Chat History"
            disableAnimation
          />
          {showChatHistory && <ChatHistoryModal />}
        </>
      }
    />
  );
};

