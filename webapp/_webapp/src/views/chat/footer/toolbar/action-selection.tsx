import { useConversationUiStore } from "@/stores/conversation/conversation-ui-store";
import { Action } from "@/views/chat/actions/actions";
import { useCallback, useMemo } from "react";
import { Selection, SelectionItem } from "./selection";

type ActionSelectionProps = {
  actions: Action[];
};

export const ActionSelection = ({ actions }: ActionSelectionProps) => {
  const { inputRef, setPrompt } = useConversationUiStore();
  const items: SelectionItem<Action>[] = useMemo(() => {
    return actions.map((action) => ({
      title: action.description,
      description: action.name,
      value: action,
    }));
  }, [actions]);

  const onSelect = useCallback((item: SelectionItem<Action>) => {
    item.value.action();
  }, []);

  const onClose = useCallback(() => {
    setPrompt("");
    inputRef.current?.focus();
  }, [setPrompt, inputRef]);

  return <Selection items={items} onSelect={onSelect} onClose={onClose} />;
};
