import { useCallback, useMemo } from "react";
import { SelectionItem, Selection } from "./selection";
import { useLanguageModels } from "../../../../hooks/useLanguageModels";
import { useConversationUiStore } from "../../../../stores/conversation/conversation-ui-store";

type ModelSelectionProps = {
  onSelectModel: () => void;
};

export function ModelSelection({ onSelectModel }: ModelSelectionProps) {
  const { inputRef } = useConversationUiStore();
  const { models, setModel } = useLanguageModels();
  const items: SelectionItem<string>[] = useMemo(() => {
    return models.map((model) => ({
      title: model.name,
      subtitle: model.slug,
      value: model.slug,
    }));
  }, [models]);

  const onSelect = useCallback(
    (item: SelectionItem<string>) => {
      setModel(models.find((m) => m.slug === item.value)!);
      onSelectModel();
      inputRef.current?.focus();
    },
    [setModel, onSelectModel, inputRef, models],
  );

  const onClose = useCallback(() => {
    onSelectModel();
    inputRef.current?.focus();
  }, [onSelectModel, inputRef]);

  return <Selection items={items} onSelect={onSelect} onClose={onClose} />;
}
