import { TabHeader } from "../../../components/tab-header";
import { ChatButton } from "./chat-button";
import { useConversationStore } from "../../../stores/conversation/conversation-store";
import { flushSync } from "react-dom";
import { useStreamingMessageStore } from "../../../stores/streaming-message-store";
import { useConversationUiStore } from "../../../stores/conversation/conversation-ui-store";
import { ChatHistoryModal } from "./chat-history-modal";
import { BranchSwitcher } from "../../../components/branch-switcher";

export const NewConversation = () => {
  flushSync(() => {
    // force UI refresh.
    useStreamingMessageStore.getState().resetStreamingMessage();
    useConversationStore.getState().setIsStreaming(false);
    useConversationStore.getState().startFromScratch();
    useConversationUiStore.getState().inputRef?.current?.focus();
  });
};

export const ShowHistory = () => {
  flushSync(() => {
    // force UI refresh.
    useConversationUiStore.getState().setShowChatHistory(true);
  });
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

