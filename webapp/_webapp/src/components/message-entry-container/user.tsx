import { cn, Tooltip } from "@heroui/react";
import { useCallback, useState } from "react";
import { AttachmentPopover } from "./attachment-popover";
import { Icon } from "@iconify/react/dist/iconify.js";
import googleAnalytics from "../../libs/google-analytics";
import { getProjectId } from "../../libs/helpers";
import { useAuthStore } from "../../stores/auth-store";
// import MarkdownComponent from "../markdown";

export const UserMessageContainer = ({
  content,
  attachment,
  stale,
  messageId,
}: {
  content: string;
  attachment: string;
  stale: boolean;
  messageId: string;
}) => {
  const { user } = useAuthStore();
  const projectId = getProjectId();
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = useCallback(() => {
    if (content) {
      googleAnalytics.fireEvent(user?.id, "messagecard_copy_user_message", {
        projectId,
        messageId: messageId,
      });
      navigator.clipboard.writeText(content);
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    }
  }, [user?.id, projectId, content, messageId]);

  const staleComponent = stale && (
    <div className="message-box-stale-description">
      Connection error. <br /> Please reload this conversation.
    </div>
  );
  return (
    // Align right
    <div className="chat-message-entry">
      <div className="message-box-user-wrapper">
        <div className="actions actions-left rnd-cancel noselect">
          <Tooltip content="Copy" placement="bottom" size="sm" delay={1000}>
            <span onClick={handleCopy} tabIndex={0} role="button" aria-label="Copy message">
              <Icon icon={copySuccess ? "tabler:copy-check" : "tabler:copy"} className="icon" />
            </span>
          </Tooltip>
        </div>
        <div className={cn("message-box-user rnd-cancel", stale && "message-box-stale")}>
          {/* <MarkdownComponent> */}
          <div className="whitespace-pre-wrap">{content || "Error: No content"}</div>
          {/* </MarkdownComponent> */}
          {attachment && <AttachmentPopover attachment={attachment} />}
          {staleComponent}
        </div>
      </div>
    </div>
  );
};
