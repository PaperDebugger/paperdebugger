import { useCallback, useMemo } from "react";
import { Action } from "../../actions/actions";
import { Selection, SelectionItem } from "./selection";

type ActionSelectionProps = {
  actions: Action[];
};

export const ActionSelection = ({ actions }: ActionSelectionProps) => {
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

  return <Selection items={items} onSelect={onSelect} />;
};
