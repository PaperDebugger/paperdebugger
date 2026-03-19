import { cn, Tooltip } from "@heroui/react";
import { GeneralToolCard } from "./tools/general";
import { useCallback, useEffect, useMemo, useState } from "react";
import googleAnalytics from "../../libs/google-analytics";
import { getProjectId } from "../../libs/helpers";
import MarkdownComponent from "../markdown";
import { TextPatches } from "../text-patches";
import { useAuthStore } from "../../stores/auth-store";
import { Icon } from "@iconify/react/dist/iconify.js";

// Helper functions
interface ParsedMessage {
  regularContent: string;
  paperDebuggerContent: string[];
}

const parseMessage = (message: string): ParsedMessage => {
  const regex = /<PaperDebugger>([\s\S]*?)<\/PaperDebugger>/g;
  const paperDebuggerContents: string[] = [];
  let regularContent = message;

  // Extract all PaperDebugger blocks
  regularContent = message.replace(regex, (_, content) => {
    const processedContent = content.replace(/\n/g, "§NEWLINE§");
    paperDebuggerContents.push(processedContent);
    return ""; // Remove the tag from regular content
  });

  return {
    regularContent: regularContent.trim(),
    paperDebuggerContent: paperDebuggerContents,
  };
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
  const parsedMessage = useMemo(() => parseMessage(message), [message]);
  const { user } = useAuthStore();
  const projectId = getProjectId();
  const [copySuccess, setCopySuccess] = useState(false);

  // Auto-collapse reasoning when message content arrives
  const [isReasoningCollapsed, setIsReasoningCollapsed] = useState(true);

  useEffect(() => {
    const hasReasoning = (reasoning?.length ?? 0) > 0;
    const hasMessage = (parsedMessage.regularContent?.length ?? 0) > 0 || parsedMessage.paperDebuggerContent.length > 0;

    // Auto-expand when reasoning arrives
    if (hasReasoning && !hasMessage) {
      setIsReasoningCollapsed(false);
    }

    // Auto-collapse when message content arrives
    if (hasReasoning && hasMessage) {
      setIsReasoningCollapsed(true);
    }
  }, [reasoning, parsedMessage]);

  const handleCopy = useCallback(() => {
    if (message) {
      googleAnalytics.fireEvent(user?.id, "messagecard_copy_message", {
        projectId,
        messageId: messageId,
      });
      navigator.clipboard.writeText(message);
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    }
  }, [user?.id, projectId, message, messageId]);

  const showMessage =
    (parsedMessage.regularContent?.length ?? 0) > 0 ||
    parsedMessage.paperDebuggerContent.length > 0 ||
    (reasoning?.length ?? 0) > 0;
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
    <GeneralToolCard
      functionName="reasoning"
      message={reasoning}
      animated={animated}
      isCollapsed={isReasoningCollapsed}
      onToggleCollapse={() => setIsReasoningCollapsed(!isReasoningCollapsed)}
      isLoading={preparing}
    />
  );
  return (
    showMessage && (
      <div className="chat-message-entry noselect">
        <div className={cn("message-box-assistant rnd-cancel", messageId.startsWith("error-") && "!text-red-500")}>
          {/* Reasoning content */}
          {reasoningComponent}

          {/* Message content */}
          <div className="canselect">
            {/* Regular markdown content */}
            {parsedMessage.regularContent && (
              <MarkdownComponent prevAttachment={prevAttachment} animated={animated}>
                {parsedMessage.regularContent}
              </MarkdownComponent>
            )}

            {/* PaperDebugger blocks */}
            {parsedMessage.paperDebuggerContent.map((content) => (
              <TextPatches key={content} attachment={prevAttachment}>
                {content}
              </TextPatches>
            ))}
          </div>

          {writingIndicator}

          {/* Stale message */}
          {staleComponent}

          {((parsedMessage.regularContent?.length || 0) > 0 || parsedMessage.paperDebuggerContent.length > 0) && (
            <div className="actions rnd-cancel noselect">
              <Tooltip content="Copy" placement="bottom" size="sm" delay={1000}>
                <span
                  onClick={handleCopy}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleCopy();
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Copy message"
                >
                  <Icon icon={copySuccess ? "tabler:copy-check" : "tabler:copy"} className="icon" />
                </span>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    )
  );
};
