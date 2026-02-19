import { useConversationUiStore } from "@/stores/conversation/conversation-ui-store";
import { useLanguageModels } from "@/hooks/useLanguageModels";
import { ChatButton } from "@/views/chat/header/chat-button";

type ChatActionsProps = {
  onShowModelSelection: () => void;
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

export function ChatActions({ onShowModelSelection }: ChatActionsProps) {
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
