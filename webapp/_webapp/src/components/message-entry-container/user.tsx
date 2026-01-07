import { cn, Tooltip } from "@heroui/react";
import { useCallback, useState } from "react";
import { AttachmentPopover } from "./attachment-popover";
import { Icon } from "@iconify/react/dist/iconify.js";
import googleAnalytics from "../../libs/google-analytics";
import { getProjectId } from "../../libs/helpers";
import { useAuthStore } from "../../stores/auth-store";
import { useSendMessageStream } from "../../hooks/useSendMessageStream";
// import MarkdownComponent from "../markdown";

export const UserMessageContainer = ({
  content,
  attachment,
  stale,
  messageId,
  previousMessageId,
}: {
  content: string;
  attachment: string;
  stale: boolean;
  messageId: string;
  previousMessageId?: string;
}) => {
  const { user } = useAuthStore();
  const projectId = getProjectId();
  const [copySuccess, setCopySuccess] = useState(false);
  const { sendMessageStream } = useSendMessageStream();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

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

  const handleSaveEdit = useCallback(async () => {
    if (!editContent.trim()) return;
    
    // If previousMessageId is undefined, it means this is the first message (root)
    // We pass "root" to indicate we want to truncate everything before this new message
    const parentId = previousMessageId ?? "root";
    
    await sendMessageStream(editContent, attachment, parentId);
    setIsEditing(false);
  }, [editContent, attachment, previousMessageId, sendMessageStream]);

  const staleComponent = stale && (
    <div className="message-box-stale-description">
      Connection error. <br /> Please reload this conversation.
    </div>
  );
  return (
    // Align right
    <div className="chat-message-entry">
      <div className="message-box-user-wrapper">
        <div className="actions actions-left rnd-cancel noselect flex gap-1">
          <Tooltip content="Edit" placement="bottom" size="sm" delay={1000}>
             <span onClick={() => {
                setIsEditing(true);
                setEditContent(content);
             }} tabIndex={0} role="button" aria-label="Edit message">
               <Icon icon="tabler:pencil" className="icon" />
             </span>
          </Tooltip>
          <Tooltip content="Copy" placement="bottom" size="sm" delay={1000}>
            <span onClick={handleCopy} tabIndex={0} role="button" aria-label="Copy message">
              <Icon icon={copySuccess ? "tabler:copy-check" : "tabler:copy"} className="icon" />
            </span>
          </Tooltip>
        </div>
        <div className={cn("message-box-user rnd-cancel", stale && "message-box-stale", isEditing && "!w-full !max-w-none")}>
          {isEditing ? (
            <div className="flex flex-col gap-2 w-full min-w-[300px]">
                <textarea
                  className="w-full p-2 rounded bg-default-100 text-small text-default-900 outline-none resize-none border border-default-200 focus:border-primary"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={Math.max(3, editContent.split('\n').length)}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                    <button 
                        className="px-3 py-1 text-tiny rounded bg-default-200 hover:bg-default-300 transition-colors"
                        onClick={() => setIsEditing(false)}
                    >
                        Cancel
                    </button>
                    <button 
                         className="px-3 py-1 text-tiny rounded bg-primary text-white hover:bg-primary-500 transition-colors"
                         onClick={handleSaveEdit}
                    >
                        Send
                    </button>
                </div>
            </div>
          ) : (
            <>
              {/* <MarkdownComponent> */}
              <div className="whitespace-pre-wrap">{content || "Error: No content"}</div>
              {/* </MarkdownComponent> */}
              {attachment && <AttachmentPopover attachment={attachment} />}
              {staleComponent}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
