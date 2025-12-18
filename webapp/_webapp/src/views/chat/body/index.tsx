import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCard } from "../../../components/message-card";
import { Conversation, Message } from "../../../pkg/gen/apiclient/chat/v2/chat_pb";
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
  const setCurrentConversation = useConversationStore((s) => s.setCurrentConversation);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const expanderRef = useRef<HTMLDivElement>(null);
  const streamingMessage = useStreamingMessageStore((s) => s.streamingMessage);
  const visibleMessages = useMemo(() => filterVisibleMessages(conversation), [conversation]);
  const [reloadSuccess, setReloadSuccess] = useState(ReloadStatus.Default);

  const conversationMode = useSettingStore((s) => s.conversationMode);
  const isDebugMode = conversationMode === "debug";

  // Scroll to the top of the last user message
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
      expanderHeight = 0; // The expander's position is absolute and renders independently from stream markdown. When stream markdown renders, the expander may scroll above the chatContainer due to user scrolling, causing expander.y < 0. In this case, we don't need the expander.
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

  const finalizedMessageCards = useMemo(
    () =>
      visibleMessages.map((message: Message, index: number) => (
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
      )),
    [visibleMessages],
  );

  const streamingMessageCards = useMemo(
    () =>
      streamingMessage.parts.map((entry) => (
        <MessageCard key={`streaming-${entry.messageId}`} animated={true} messageEntry={entry} />
      )),
    [streamingMessage.parts],
  );

  if (isEmptyConversation()) {
    return <EmptyView />;
  }


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

