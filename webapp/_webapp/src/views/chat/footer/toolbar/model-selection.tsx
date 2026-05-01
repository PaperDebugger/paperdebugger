import { useCallback, useMemo } from "react";
import { SelectionItem, Selection } from "./selection";
import { useLanguageModels } from "../../../../hooks/useLanguageModels";
import { useConversationUiStore } from "../../../../stores/conversation/conversation-ui-store";

type ModelSelectionProps = {
  onSelectModel: () => void;
};

export function ModelSelection({ onSelectModel }: ModelSelectionProps) {
  const { inputRef } = useConversationUiStore();
  const { models, currentModel, setModel } = useLanguageModels();

  const items: SelectionItem<string>[] = useMemo(() => {
    const customModels = models.filter((m) => m.isCustom);
    const builtInModels = models.filter((m) => !m.isCustom);

    const mapToItem = (model: (typeof models)[number]): SelectionItem<string> => ({
      title: model.name,
      subtitle: `${model.slug}${model.isCustom ? " (Custom)" : ""}`,
      value: model.slug,
      disabled: model.disabled,
      disabledReason: model.disabledReason,
      id: model.id ?? undefined,
      isCustom: model.isCustom,
    });

    const customItems = customModels.map(mapToItem);
    const builtInItems = builtInModels.map(mapToItem);

    if (customItems.length > 0 && builtInItems.length > 0) {
      return [
        ...customItems,
        {
          title: "divider",
          value: "__divider__" as string,
          disabled: true,
          isDivider: true,
        },
        ...builtInItems,
      ];
    }

    return [...customItems, ...builtInItems];
  }, [models]);

  const onSelect = useCallback(
    (item: SelectionItem<string>) => {
      if (item.disabled || item.isDivider) return;

      const selectedModel = item.isCustom
        ? ((item.id ? models.find((m) => m.id === item.id) : undefined) ?? models.find((m) => m.slug === item.value))
        : models.find((m) => m.slug === item.value);
      if (!selectedModel) return;

      setModel(selectedModel);
      onSelectModel();
      inputRef.current?.focus();
    },
    [setModel, onSelectModel, inputRef, models],
  );

  const onClose = useCallback(() => {
    onSelectModel();
    inputRef.current?.focus();
  }, [onSelectModel, inputRef]);

  return <Selection items={items} initialValue={currentModel?.slug} onSelect={onSelect} onClose={onClose} />;
}
