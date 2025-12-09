import { useEffect } from "react";

import { ChatBody } from "./body";
import { ChatHeader } from "./header";
import { useConversationStore } from "../../stores/conversation/conversation-store";
import { useConversationUiStore } from "../../stores/conversation/conversation-ui-store";
import { PromptInput } from "./footer";

export const Chat = () => {
  const { currentConversation } = useConversationStore();
  const { inputRef } = useConversationUiStore();

  useEffect(() => {
    if (inputRef?.current) {
      inputRef.current.focus();
    }
  }, [inputRef]);

  return (
    <div className="pd-app-tab-content" id="pd-chat-container">
      <ChatHeader />
      <ChatBody conversation={currentConversation} />
      <PromptInput />
    </div>
  );
};
