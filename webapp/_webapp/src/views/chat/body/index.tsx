import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCard } from "../../../components/message-card";
import { Conversation } from "../../../pkg/gen/apiclient/chat/v2/chat_pb";
import {
  isEmptyConversation,
  getPrevUserSelectedText,
  findLastUserMessageIndex,
  displayMessageToMessageEntry,
} from "../helper";
import { StatusIndicator } from "./status-indicator";
import { EmptyView } from "./empty-view";
import { useMessageStore } from "../../../stores/message-store";
import { useSettingStore } from "../../../stores/setting-store";
import { useConversationStore } from "../../../stores/conversation/conversation-store";
import { useStreamingStateMachine } from "../../../stores/streaming";
import { getConversation } from "../../../query/api";
import { DisplayMessage } from "../../../stores/types";

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
  const [reloadSuccess, setReloadSuccess] = useState(ReloadStatus.Default);

  const conversationMode = useSettingStore((s) => s.conversationMode);
  const isDebugMode = conversationMode === "debug";

  // Use the unified message store to get all display messages
  const allDisplayMessages = useMessageStore((s) => s.getAllDisplayMessages());
  
  // Filter visible messages (non-empty user/assistant, all tool calls)
  const visibleMessages = useMemo(() => {
    return allDisplayMessages.filter((msg: DisplayMessage) => {
      if (msg.type === "user") return msg.content.length > 0;
      if (msg.type === "assistant") return msg.content.length > 0;
      if (msg.type === "toolCall" || msg.type === "toolCallPrepare") return true;
      return false;
    });
  }, [allDisplayMessages]);

  // Find the last user message index for scroll behavior
  const lastUserMessageIndex = useMemo(
    () => findLastUserMessageIndex(visibleMessages),
    [visibleMessages]
  );

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
      expanderHeight = 0;
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

  // Render all messages using the unified DisplayMessage array
  const messageCards = useMemo(
    () =>
      visibleMessages.map((msg: DisplayMessage, index: number) => {
        const isStreaming = msg.status === "streaming";
        const isLastUserMsg = index === lastUserMessageIndex;

        return (
          <div
            key={msg.id}
            ref={isLastUserMsg ? lastUserMsgRef : undefined}
          >
            <MessageCard
              animated={isStreaming}
              messageEntry={displayMessageToMessageEntry(msg)}
              prevAttachment={getPrevUserSelectedText(visibleMessages, index)}
              previousMessageId={index > 0 ? visibleMessages[index - 1].id : undefined}
            />
          </div>
        );
      }),
    [visibleMessages, lastUserMessageIndex]
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
      <div id="pd-chat-item-container-messages" style={{ zIndex: 3 }}>
        {messageCards}
      </div>

      <div id="pd-chat-item-container-status" style={{ position: "relative" }}>
        <div id="pd-chat-item-container-status-indicator" style={{ position: "relative", zIndex: 2 }}>
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
                  useStreamingStateMachine.getState().reset();
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
