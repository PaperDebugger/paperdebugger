import { cn } from "@heroui/react";
import { AttachmentPopover } from "./attachment-popover";
// import MarkdownComponent from "../markdown";

export const UserMessageContainer = ({
  content,
  attachment,
  stale,
}: {
  content: string;
  attachment: string;
  stale: boolean;
}) => {
  const staleComponent = stale && (
    <div className="message-box-stale-description">
      Connection error. <br /> Please reload this conversation.
    </div>
  );
  return (
    // Align right
    <div className="chat-message-entry">
      <div className={cn("message-box-user rnd-cancel", stale && "message-box-stale")}>
        {/* <MarkdownComponent> */}
        <div className="whitespace-pre-wrap">{content || "Error: No content"}</div>
        {/* </MarkdownComponent> */}
        {attachment && <AttachmentPopover attachment={attachment} />}
        {staleComponent}
      </div>
    </div>
  );
};
