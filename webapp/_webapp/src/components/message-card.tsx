import { cn } from "@heroui/react";
import { memo } from "react";
import Tools from "./message-entry-container/tools/tools";
import { MessageEntry, MessageEntryStatus } from "../stores/conversation/types";
import { AssistantMessageContainer } from "./message-entry-container/assistant";
import { UserMessageContainer } from "./message-entry-container/user";
import { ToolCallPrepareMessageContainer } from "./message-entry-container/toolcall-prepare";
import { UnknownEntryMessageContainer } from "./message-entry-container/unknown-entry";

// Constants
export const STYLES = {
  container: {
    base: "!flex !flex-row !gap-2",
    assistant: "",
    indicator: "",
  },
  messageWrapper: {
    base: "!max-w-full !flex !flex-col !gap-4",
    assistant: "!max-w-[100%]",
    user: "!max-w-[70%]",
    indicator: "!w-full",
  },
  messageBox: {
    base: cn(),
    assistant: "px-3 pt-3 pb-1 my-2 !border !border-transparent",
    user: "px-3 py-2 bg-gray-100 self-end my-2",
    indicator: "px-3",
  },
  attachment: {
    content: "!max-w-[300px] !bg-default-100 dark:!bg-default-100",
    text: "!text-tiny !text-default-400",
  },
} as const;

// Types
interface MessageCardProps {
  messageEntry: MessageEntry;
  prevAttachment?: string;
  animated?: boolean;
}

export const MessageCard = memo(({ messageEntry, prevAttachment, animated }: MessageCardProps) => {
  if (messageEntry.toolCall !== undefined) {
    return (
      <div className="chat-message-entry">
        <Tools
          messageId={messageEntry.messageId}
          functionName={messageEntry.toolCall?.name || "MessageEntry.toolCall.name is undefined"}
          message={messageEntry.toolCall?.result}
          error={messageEntry.toolCall?.error}
          preparing={messageEntry.status === MessageEntryStatus.PREPARING}
          animated={animated ?? false}
        />
      </div>
    );
  }

  const returnComponent = () => {
    if (messageEntry.assistant !== undefined) {
      return (
        <AssistantMessageContainer
          message={messageEntry.assistant?.content}
          messageId={messageEntry.messageId}
          animated={animated ?? false}
          prevAttachment={prevAttachment ?? ""}
          stale={messageEntry.status === MessageEntryStatus.STALE}
          preparing={messageEntry.status === MessageEntryStatus.PREPARING}
        />
      );
    }

    if (messageEntry.toolCallPrepareArguments !== undefined) {
      return (
        <ToolCallPrepareMessageContainer
          stale={messageEntry.status === MessageEntryStatus.STALE}
          preparing={messageEntry.status === MessageEntryStatus.PREPARING}
        />
      );
    }

    if (messageEntry.user !== undefined) {
      return (
        <UserMessageContainer
          content={messageEntry.user?.content ?? ""}
          attachment={messageEntry.user?.selectedText ?? ""}
          stale={messageEntry.status === MessageEntryStatus.STALE}
        />
      );
    }

    return <UnknownEntryMessageContainer message={`Error: Unknown message: ${JSON.stringify(messageEntry)}`} />;
  };

  return <>{returnComponent()}</>;
});

MessageCard.displayName = "MessageCard";
