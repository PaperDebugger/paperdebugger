import { useConversationUiStore } from "../../../../stores/conversation/conversation-ui-store";
import { useLanguageModels } from "../../../../hooks/useLanguageModels";
import { ChatButton } from "../../header/chat-button";

type ChatActionsProps = {
  onShowModelSelection: () => void;
};

// Map provider names to their respective icons
const getProviderIcon = (provider: string | undefined): string => {
  switch (provider) {
    case "openai":
      return "tabler:brand-openai";
    case "qwen":
      return "simple-icons:alibabadotcom";
    case "gemini":
      return "simple-icons:googlegemini";
    default:
      return "tabler:brain";
  }
};

export function ChatActions({ onShowModelSelection }: ChatActionsProps) {
  const { inputRef, setPrompt } = useConversationUiStore();
  const { currentModel } = useLanguageModels();

  return (
    <div className="flex flex-row gap-2 noselect">
      <ChatButton
        onMouseDown={(e) => e.stopPropagation()}
        icon="tabler:notebook"
        text="Prompts"
        alwaysShowText
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
