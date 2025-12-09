import { useCallback, useMemo } from "react";
import { SelectionItem, Selection } from "./selection";
import { useLanguageModels } from "../../../../hooks/useLanguageModels";
import { LanguageModel } from "../../../../pkg/gen/apiclient/chat/v1/chat_pb";
import { useConversationUiStore } from "../../../../stores/conversation/conversation-ui-store";

type ModelSelectionProps = {
  onSelectModel: (languageModel: LanguageModel) => void;
};

export function ModelSelection({ onSelectModel }: ModelSelectionProps) {
  const { inputRef } = useConversationUiStore();
  const { models, setModel } = useLanguageModels();
  const items: SelectionItem<LanguageModel>[] = useMemo(() => {
    return models.map((model) => ({
      title: model.name,
      description: model.description,
      value: model.languageModel,
    }));
  }, [models]);

  const onSelect = useCallback(
    (item: SelectionItem<LanguageModel>) => {
      setModel(models.find((m) => m.languageModel === item.value)!);
      onSelectModel(item.value);
      inputRef.current?.focus();
    },
    [setModel, onSelectModel, inputRef, models],
  );

  return <Selection items={items} onSelect={onSelect} />;
}
