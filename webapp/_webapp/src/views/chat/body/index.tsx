import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MessageCard } from "../../../components/message-card";
import { Conversation } from "../../../pkg/gen/apiclient/chat/v2/chat_pb";
import {
  isEmptyConversation,
  getPrevUserSelectedText,
  findLastUserMessageIndex,
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
  const [reloadSuccess, setReloadSuccess] = useState(ReloadStatus.Default);

  const conversationMode = useSettingStore((s) => s.conversationMode);
  const isDebugMode = conversationMode === "debug";

  // Use the unified message store to get all display messages
  const allDisplayMessages = useMessageStore((s) => s.allDisplayMessages);
  
  // Filter visible messages (non-empty user/assistant, all tool calls)
  const visibleMessages = useMemo(() => {
    return allDisplayMessages.filter((msg: DisplayMessage) => {
      if (msg.type === "user") return msg.content.length > 0;
      if (msg.type === "assistant") return msg.content.length > 0 || (msg.reasoning?.length ?? 0) > 0;
      if (msg.type === "toolCall" || msg.type === "toolCallPrepare") return true;
      return false;
    });
  }, [allDisplayMessages]);

  // Find the last user message index for scroll behavior
  const lastUserMessageIndex = useMemo(
    () => findLastUserMessageIndex(visibleMessages),
    [visibleMessages]
  );

  // Get the last user message ID to track when it changes
  const lastUserMessageId = useMemo(() => {
    if (lastUserMessageIndex === -1) return null;
    return visibleMessages[lastUserMessageIndex]?.id ?? null;
  }, [visibleMessages, lastUserMessageIndex]);

  // Scroll the last user message to the top of the viewport (container only)
  const scrollToLastUserMessage = useCallback(() => {
    if (!lastUserMsgRef.current || !chatContainerRef.current) return;
    
    const container = chatContainerRef.current;
    const target = lastUserMsgRef.current;
    
    container.scrollTo({
      top: target.offsetTop,
      behavior: "smooth",
    });
  }, []);

  // Auto-scroll only when a new user message is added
  useEffect(() => {
    if (!lastUserMessageId) return;
    
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      scrollToLastUserMessage();
    });
  }, [lastUserMessageId, scrollToLastUserMessage]);

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
              message={msg}
              prevAttachment={getPrevUserSelectedText(visibleMessages, index)}
            />
          </div>
        );
      }),
    [visibleMessages, lastUserMessageIndex]
  );

  if (isEmptyConversation()) {
    return <EmptyView />;
  }

  return (
    <div className="pd-app-tab-content-body" id="pd-chat-item-container" ref={chatContainerRef}>
      {/* Spacer that pushes content down and provides scroll space for last user message */}
      <div className="flex-1 min-h-0" aria-hidden="true" />
      
      <div className="pd-chat-item-container-messages">
        {messageCards}
      </div>

      <div id="pd-chat-item-container-status" className="relative">
        <StatusIndicator conversation={conversation} />
        
        {isDebugMode && (
          <div className="text-xs text-default-300 dark:!text-default-300 noselect">
            <span>* Debug mode is enabled, </span>
            <span
              className={`${reloadSuccess ? "text-emerald-300" : "text-default-300 dark:!text-default-300"} underline cursor-pointer rnd-cancel`}
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
      
      {/* Bottom spacer to allow scrolling the last user message to the top */}
      <div 
        className="flex-shrink-0" 
        style={{ minHeight: "calc(100% - 80px)" }}
        aria-hidden="true" 
      />
    </div>
  );
};
