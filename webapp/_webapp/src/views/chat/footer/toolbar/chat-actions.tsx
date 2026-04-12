import { useConversationUiStore } from "../../../../stores/conversation/conversation-ui-store";
import { useLanguageModels } from "../../../../hooks/useLanguageModels";
import { ChatButton } from "../../header/chat-button";

type ChatActionsProps = {
  onShowModelSelection: () => void;
  onReviewAndInsert: () => void;
  reviewAndInsertDisabled?: boolean;
};

// Map provider names to their respective icons
const getProviderIcon = (provider: string | undefined): string => {
  switch (provider) {
    case "openai":
      return "tabler:brand-openai";
    case "qwen":
      return "hugeicons:qwen";
    case "google":
      return "vscode-icons:file-type-gemini";
    case "deepseek":
      return "ri:deepseek-fill";
    case "anthropic":
      return "ri:anthropic-fill";
    default:
      return "tabler:brain";
  }
};

export function ChatActions({ onShowModelSelection, onReviewAndInsert, reviewAndInsertDisabled }: ChatActionsProps) {
  const { inputRef, setPrompt, prompt } = useConversationUiStore();
  const { currentModel } = useLanguageModels();

  const isPromptsAndActionsDisabled = prompt.length > 0 && !prompt.startsWith("/") && !prompt.startsWith(":");

  return (
    <div className="flex flex-row gap-2 noselect">
      <ChatButton
        onMouseDown={(e) => e.stopPropagation()}
        icon="tabler:notebook"
        text="Prompts"
        alwaysShowText
        disabled={isPromptsAndActionsDisabled}
        onClick={() => {
          if (inputRef.current) {
            setPrompt("/");
            inputRef.current.focus();
          }
        }}
      />

      <ChatButton
        onMouseDown={(e) => e.stopPropagation()}
        icon="tabler:sparkles"
        text="Actions"
        alwaysShowText
        disabled={isPromptsAndActionsDisabled}
        onClick={() => {
          if (inputRef.current) {
            setPrompt(":");
            inputRef.current.focus();
          }
        }}
      />
      <ChatButton
        onMouseDown={(e) => e.stopPropagation()}
        icon="tabler:file-pencil"
        text="Review & Insert"
        alwaysShowText
        disabled={reviewAndInsertDisabled}
        onClick={onReviewAndInsert}
      />
      <div className="flex-1"></div>
      <ChatButton
        className="ms-auto"
        icon={getProviderIcon(currentModel?.provider)}
        text={currentModel?.name}
        tooltip="Click to change model"
        tooltipSize="sm"
        alwaysShowText
        onClick={onShowModelSelection}
      />
    </div>
  );
}
