import { cn, Tooltip } from "@heroui/react";
import { GeneralToolCard } from "./tools/general";
import { useCallback, useMemo, useState } from "react";
import googleAnalytics from "../../libs/google-analytics";
import { getProjectId } from "../../libs/helpers";
import MarkdownComponent from "../markdown";
import { useAuthStore } from "../../stores/auth-store";
import { Icon } from "@iconify/react/dist/iconify.js";

// Helper functions
const preprocessMessage = (message: string): string | undefined => {
  const regex = /<PaperDebugger>([\s\S]*?)<\/PaperDebugger>/g;
  return message.replace(regex, (_, content) => {
    const processedContent = content.replace(/\n/g, "§NEWLINE§");
    return `<PaperDebugger>${processedContent}</PaperDebugger>`;
  });
};

export const AssistantMessageContainer = ({
  message,
  reasoning,
  messageId,
  animated,
  prevAttachment,
  stale,
  preparing,
}: {
  message: string;
  reasoning?: string;
  messageId: string;
  animated: boolean;
  prevAttachment: string;
  stale: boolean;
  preparing: boolean;
}) => {
  const processedMessage = useMemo(() => preprocessMessage(message), [message]);
  const { user } = useAuthStore();
  const projectId = getProjectId();
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = useCallback(() => {
    if (processedMessage) {
      googleAnalytics.fireEvent(user?.id, "messagecard_copy_message", {
        projectId,
        messageId: messageId,
      });
      navigator.clipboard.writeText(processedMessage);
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    }
  }, [user?.id, projectId, processedMessage, messageId]);

  const showMessage = (processedMessage?.length || 0 > 0) || (reasoning?.length || 0 > 0);
  const staleComponent = stale && <div className="message-box-stale-description">This message is stale.</div>;
  const writingIndicator =
    stale || !showMessage ? null : (
      <Icon
        icon="tabler:pencil"
        className={cn(
          "!w-4 !h-4 !text-[14px] !text-gray-400  !animate-bounce",
          "!transition-all !duration-300 !ease-in-out",
          "!inline-block !align-middle !ml-1",
          preparing && "!opacity-100",
          !preparing && "!opacity-0 !hidden",
        )}
      />
    );

  const reasoningComponent = reasoning && (
    <div key="reasoning" className="reasoning-container mb-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <GeneralToolCard functionName="reasoning" message={reasoning} animated={animated} />
    </div>
  );

  return (
    showMessage && (
      <div className="chat-message-entry noselect">
        <div className={cn("message-box-assistant rnd-cancel", messageId.startsWith("error-") && "!text-red-500")}>
          {/* Reasoning content */}
          {reasoningComponent}

          {/* Message content */}
          <div className="canselect">
            <MarkdownComponent prevAttachment={prevAttachment} animated={animated}>
              {processedMessage || ""}
            </MarkdownComponent>
          </div>

          {writingIndicator}

          {/* Stale message */}
          {staleComponent}

          <div className="actions rnd-cancel noselect">
            <Tooltip content="Copy" placement="bottom" size="sm" delay={1000}>
              <span onClick={handleCopy} tabIndex={0} role="button" aria-label="Copy message">
                <Icon icon={copySuccess ? "tabler:copy-check" : "tabler:copy"} className="icon" />
              </span>
            </Tooltip>
          </div>
        </div>
      </div>
    )
  );
};

