import { useMemo } from "react";
import { TabHeader } from "../../../components/tab-header";
import { ChatButton } from "./chat-button";
import { useConversationStore } from "../../../stores/conversation/conversation-store";
import { flushSync } from "react-dom";
import { useStreamingMessageStore } from "../../../stores/streaming-message-store";
import { useConversationUiStore } from "../../../stores/conversation/conversation-ui-store";
import { Message } from "../../../pkg/gen/apiclient/chat/v1/chat_pb";
import { ChatHistoryModal } from "./chat-history-modal";

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
  const { currentConversation } = useConversationStore();
  const { showChatHistory } = useConversationUiStore();

  const title = currentConversation?.title ?? "New Conversation";
  const messageCount = useMemo(() => {
    return (
      currentConversation.messages.filter(
        (m: Message) => m.payload?.messageType.case === "assistant" || m.payload?.messageType.case === "user",
      ).length ?? 0
    );
  }, [currentConversation]);

  return (
    <TabHeader
      title={title}
      subTitle={`${messageCount} message${messageCount <= 1 ? "" : "s"}`}
      actions={
        <>
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
