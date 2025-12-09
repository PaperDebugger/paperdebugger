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

  return <Selection items={items} onSelect={onSelect} />;
}
