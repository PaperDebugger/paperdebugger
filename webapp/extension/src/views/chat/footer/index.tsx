import { Button } from "@heroui/button";
import { useCallback, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useSelectionStore } from "../../../stores/selection-store";
import googleAnalytics from "../../../libs/google-analytics";
import { useConversationUiStore } from "../../../stores/conversation/conversation-ui-store";
import { useConversationStore } from "../../../stores/conversation/conversation-store";
import { useSendMessageStream } from "../../../hooks/useSendMessageStream";
import { useAuthStore } from "../../../stores/auth-store";
import { cn } from "@heroui/react";
import { SelectedTextIndicator } from "./selected-text-indicator";
import { PromptSelection } from "./toolbar/prompt-selection";
import { ActionSelection } from "./toolbar/action-selection";
import { usePromptLibraryStore } from "../../../stores/prompt-library-store";
import { useActions } from "../actions/actions";
import { ChatActions } from "./toolbar/chat-actions";
import { ModelSelection } from "./toolbar/model-selection";
import { useSettingStore } from "../../../stores/setting-store";

// Add animation keyframes
const blinkAnimation = `@keyframes blink {
  0% {
    background-color: rgb(249 250 251);
  }
  50% {
    background-color: rgb(204 255 229);
  }
  100% {
    background-color: rgb(249 250 251);
  }
}`;

// Add style tag to head
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = blinkAnimation;
  document.head.appendChild(style);
}

export function PromptInput() {
  const { prompt, heightCollapseRequired, inputRef, setPrompt } = useConversationUiStore();
  const { searchPrompts } = usePromptLibraryStore();
  const [showModelSelection, setShowModelSelection] = useState(false);
  const prompts = useMemo(
    () => (!prompt.startsWith("/") ? [] : searchPrompts(prompt.slice(1))),
    [prompt, searchPrompts],
  );
  const actions = useActions({
    enabled: prompt.startsWith(":"),
    filter: prompt.startsWith(":") ? prompt.slice(1) : undefined,
  });

  const { user } = useAuthStore();
  const { isStreaming, setIsStreaming } = useConversationStore();
  const selectedText = useSelectionStore((s) => s.selectedText);
  const { sendMessageStream } = useSendMessageStream();
  const { minimalistMode } = useSettingStore();

  const handleModelSelect = useCallback(() => {
    setShowModelSelection(false);
  }, []);

  const submit = useCallback(async () => {
    googleAnalytics.fireEvent(user?.id, "Send Chat Message", {
      promptLength: prompt.length,
      selectedTextLength: selectedText?.length,
      userId: user?.id,
    });
    setPrompt("");
    setIsStreaming(true);
    await sendMessageStream(prompt, selectedText ?? "");
    setIsStreaming(false);
  }, [sendMessageStream, prompt, selectedText, user?.id, setIsStreaming, setPrompt]);
  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Check if IME composition is in progress to avoid submitting during Chinese input
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.nativeEvent.isComposing && // Prevent submission during IME composition
        !prompt.startsWith("/") && // Select prompt
        !prompt.startsWith(":") // Select action
      ) {
        e.preventDefault();
        e.stopPropagation();
        await submit();
      }
    },
    [prompt, submit],
  );

  return (
    <div className="pd-app-tab-content-footer chat-prompt-input noselect rnd-cancel">
      {prompts.length > 0 && <PromptSelection prompts={prompts} />}
      {actions.length > 0 && <ActionSelection actions={actions} />}
      {showModelSelection && <ModelSelection onSelectModel={handleModelSelect} />}

      <div className={cn("pd-chat-toolbar noselect", heightCollapseRequired || minimalistMode ? "collapsed" : "")}>
        {prompts.length == 0 && actions.length == 0 && !showModelSelection && (
          <ChatActions onShowModelSelection={() => setShowModelSelection(true)} />
        )}
      </div>
      <div className="w-full noselect">
        {selectedText && <SelectedTextIndicator />}
        <div className="border border-gray-100 rounded-lg p-2 flex flex-col gap-2 relative prompt-input-container bg-white transition-all">
          <textarea
            onMouseDown={(e) => e.stopPropagation()}
            id="pd-chat-prompt-input"
            ref={inputRef}
            className={cn(
              "flex-grow border-none resize-none noselect focus:outline-none rnd-cancel",
              heightCollapseRequired || minimalistMode ? "w-[calc(100%-1rem)]" : "w-full",
            )}
            style={{
              fontSize: heightCollapseRequired || minimalistMode ? "12px" : "14px",
              transition: "font-size 0.2s ease-in-out",
            }}
            rows={heightCollapseRequired || minimalistMode ? 1 : 3}
            placeholder={
              heightCollapseRequired || minimalistMode
                ? "Your prompts here..."
                : "Enter to send, Shift + Enter to wrap, / to search prompts, : to use actions"
            }
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
            }}
            onKeyDown={handleKeyDown}
          />
          <div
            className={cn(
              "absolute flex flex-row gap-2 transition-all",
              heightCollapseRequired || minimalistMode ? "bottom-0 right-0" : "bottom-3 right-3",
            )}
          >
            <Button
              isLoading={isStreaming}
              isIconOnly
              color={"primary"}
              isDisabled={!prompt || isStreaming}
              radius="full"
              size="sm"
              className={cn(heightCollapseRequired || minimalistMode ? "scale-[0.7]" : "")}
              type="submit"
              variant="solid"
              onPress={submit}
            >
              <Icon icon="tabler:arrow-up" fontSize={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
