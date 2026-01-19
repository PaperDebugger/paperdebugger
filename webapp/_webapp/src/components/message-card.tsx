import { cn } from "@heroui/react";
import { memo } from "react";
import Tools from "./message-entry-container/tools/tools";
import { DisplayMessage } from "../stores/types";
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
  /** The display message to render (unified format) */
  message: DisplayMessage;
  /** Selected text from the previous user message */
  prevAttachment?: string;
  /** ID of the previous message (for branching) */
  previousMessageId?: string;
  /** Whether to animate the message (for streaming) */
  animated?: boolean;
}

/**
 * MessageCard component renders a single message in the chat.
 * Now accepts DisplayMessage directly instead of MessageEntry.
 */
export const MessageCard = memo(({ message, prevAttachment, previousMessageId, animated }: MessageCardProps) => {
  const isStale = message.status === "stale";
  const isPreparing = message.status === "streaming";

  const returnComponent = () => {
    if (message.type === "toolCall") {
      return (
        <div className="chat-message-entry rnd-cancel">
          <Tools
            messageId={message.id}
            functionName={message.toolName || "Unknown tool"}
            message={message.toolResult ?? ""}
            error={message.toolError ?? ""}
            preparing={isPreparing}
            animated={animated ?? false}
          />
        </div>
      );
    }

    if (message.type === "assistant") {
      return (
        <AssistantMessageContainer
          message={message.content}
          reasoning={message.reasoning}
          messageId={message.id}
          animated={animated ?? false}
          prevAttachment={prevAttachment ?? ""}
          stale={isStale}
          preparing={isPreparing}
        />
      );
    }

    if (message.type === "toolCallPrepare") {
      return (
        <ToolCallPrepareMessageContainer
          functionName={message.toolName || "Unknown tool"}
          stale={isStale}
          preparing={isPreparing}
        />
      );
    }

    if (message.type === "user") {
      return (
        <UserMessageContainer
          content={message.content ?? ""}
          attachment={message.selectedText ?? ""}
          stale={isStale}
          messageId={message.id}
          previousMessageId={previousMessageId}
        />
      );
    }

    return <UnknownEntryMessageContainer message={`Error: Unknown message type: ${message.type}`} />;
  };

  return <>{returnComponent()}</>;
});

MessageCard.displayName = "MessageCard";
