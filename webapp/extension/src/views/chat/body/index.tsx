import { useEffect, useRef, useState } from "react";
import { MessageCard } from "../../../components/message-card";
import { Conversation } from "../../../pkg/gen/apiclient/chat/v1/chat_pb";
import { filterVisibleMessages, getPrevUserMessage, isEmptyConversation, messageToMessageEntry } from "../helper";
import { StatusIndicator } from "./status-indicator";
import { EmptyView } from "./empty-view";
import { useStreamingMessageStore } from "../../../stores/streaming-message-store";
import { useSettingStore } from "../../../stores/setting-store";
import { useConversationStore } from "../../../stores/conversation/conversation-store";
import { getConversation } from "../../../query/api";

interface ChatBodyProps {
  conversation?: Conversation;
}

enum ReloadStatus {
  Default = 0,
  Success = 1,
  Failed = 2,
}

export const ChatBody = ({ conversation }: ChatBodyProps) => {
  const { setCurrentConversation } = useConversationStore();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const expanderRef = useRef<HTMLDivElement>(null);
  const streamingMessage = useStreamingMessageStore((s) => s.streamingMessage);
  const visibleMessages = filterVisibleMessages(conversation);
  const [reloadSuccess, setReloadSuccess] = useState(ReloadStatus.Default);

  const { conversationMode } = useSettingStore();
  const isDebugMode = conversationMode === "debug";

  // 滚动到最后一条 user 消息顶部
  useEffect(() => {
    if (expanderRef.current) {
      expanderRef.current.style.height = "1000px";
    }

    const chatContainerHeight = chatContainerRef.current?.clientHeight ?? 0;
    const expanderViewOffset =
      (expanderRef.current?.getBoundingClientRect().top ?? 0) -
      (chatContainerRef.current?.getBoundingClientRect().y ?? 0);

    let expanderHeight: number;
    if (expanderViewOffset < 0) {
      expanderHeight = 0; // expander 的 positoin 是 absolute，和 stream markdown 独立渲染。当 stream markdown 渲染的时候，expander 可能会因为用户滚动滑到 chatContainer 上面，导致 expander.y < 0。这个时候我们就不需要 expander 了
    } else {
      expanderHeight = chatContainerHeight - expanderViewOffset;
    }

    if (expanderRef.current) {
      const lastUserMsgHeight = lastUserMsgRef.current?.clientHeight ?? 0;
      expanderRef.current.style.height = chatContainerHeight - lastUserMsgHeight - 8 + "px";
    }

    if (lastUserMsgRef.current && chatContainerRef.current) {
      const container = chatContainerRef.current;
      const target = lastUserMsgRef.current;
      container.scrollTo({
        top: target.offsetTop,
        behavior: "smooth",
      });
    } else {
      if (expanderRef.current) {
        expanderRef.current.style.height = (expanderHeight < 0 ? 0 : expanderHeight) + "px";
      }
    }
  }, [visibleMessages.length]);

  if (isEmptyConversation()) {
    return <EmptyView />;
  }

  const finalizedMessageCards = visibleMessages.map((message, index) => (
    <div
      key={index}
      ref={
        index === visibleMessages.length - 1 && message.payload?.messageType.case === "user"
          ? lastUserMsgRef
          : undefined
      }
    >
      <MessageCard
        animated={false}
        messageEntry={messageToMessageEntry(message)}
        prevAttachment={getPrevUserMessage(visibleMessages, index)?.selectedText}
      />
    </div>
  ));

  const streamingMessageCards = streamingMessage.parts.map((entry) => (
    <MessageCard key={`streaming-${entry.messageId}`} animated={true} messageEntry={entry} />
  ));

  const expander = (
    <div
      style={{
        height: "0px",
        backgroundColor: "transparent",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
      aria-hidden="true"
      id="expander"
      ref={expanderRef}
    />
  );

  return (
    <div className="pd-app-tab-content-body" id="pd-chat-item-container" ref={chatContainerRef}>
      <div id="pd-chat-item-container-previous-messages" style={{ zIndex: 3 }}>
        {finalizedMessageCards}
      </div>

      <div id="pd-chat-item-container-current-messages" style={{ position: "relative" }}>
        <div id="pd-chat-item-container-current-messages-entries" style={{ position: "relative", zIndex: 2 }}>
          {streamingMessageCards}
          <StatusIndicator conversation={conversation} />
        </div>

        {expander}
        {isDebugMode && (
          <div className="text-xs text-gray-300 z-1 noselect">
            <span>* Debug mode is enabled, </span>
            <span
              className={`${reloadSuccess ? "text-emerald-300" : "text-gray-300"} underline cursor-pointer rnd-cancel`}
              onClick={async () => {
                try {
                  const response = await getConversation({ conversationId: conversation?.id ?? "" });
                  if (!response.conversation) {
                    throw new Error(`Failed to load conversation ${conversation?.id ?? "unknown"}`);
                  }
                  setCurrentConversation(response.conversation);
                  useStreamingMessageStore.getState().resetStreamingMessage();
                  useStreamingMessageStore.getState().resetIncompleteIndicator();
                  setReloadSuccess(ReloadStatus.Success);
                } catch {
                  setReloadSuccess(ReloadStatus.Failed);
                } finally {
                  setTimeout(() => {
                    setReloadSuccess(ReloadStatus.Default);
                  }, 3000);
                }
              }}
            >
              {reloadSuccess ? "reloaded" : "reload"}
            </span>
            <span> the conversation to see the actual prompts.</span>
          </div>
        )}
      </div>
    </div>
  );
};
