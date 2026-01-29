import { useCallback, useMemo } from "react";
import { SelectionItem, Selection } from "./selection";
import { Prompt } from "../../../../pkg/gen/apiclient/user/v1/user_pb";
import { useConversationUiStore } from "../../../../stores/conversation/conversation-ui-store";

type PromptSelectionProps = {
  prompts: Prompt[];
};

export function PromptSelection({ prompts }: PromptSelectionProps) {
  const { inputRef, setPrompt } = useConversationUiStore();
  const items: SelectionItem<Prompt>[] = useMemo(() => {
    return (
      prompts.map((prompt) => ({
        title: prompt.title,
        description: prompt.content,
        value: prompt,
      })) || []
    );
  }, [prompts]);

  const onSelect = useCallback(
    (item: SelectionItem<Prompt>) => {
      if (inputRef.current) {
        setPrompt(item.value.content);
        inputRef.current.focus();
      }
    },
    [inputRef, setPrompt],
  );

  const onClose = useCallback(() => {
    // Clear the prompt to hide the selection menu
    setPrompt("");
    inputRef.current?.focus();
  }, [setPrompt, inputRef]);

  if (prompts.length === 0) {
    return (
      <div className="transition-all duration-100 absolute bottom-full left-0 right-0 mb-1 z-50 bg-white shadow-lg rounded-lg border border-gray-200 p-4">
        <div className="text-gray-500 text-sm text-center">No prompts found</div>
      </div>
    );
  }
  
  return <Selection items={items} onSelect={onSelect} onClose={onClose} />;
}
