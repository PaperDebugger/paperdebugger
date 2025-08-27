import { useConversationUiStore } from "../../../../stores/conversation/conversation-ui-store";
import { useLanguageModels } from "../../../../hooks/useLanguageModels";
import { ChatButton } from "../../header/chat-button";

type ChatActionsProps = {
  onShowModelSelection: () => void;
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
        icon="tabler:brand-openai"
        text={currentModel?.name}
        tooltip="Click to change model"
        tooltipSize="sm"
        alwaysShowText
        onClick={onShowModelSelection}
      />
    </div>
  );
}
