import { useMemo } from "react";
import { useConversationUiStore } from "@/stores/conversation/conversation-ui-store";
import { NewConversation, ShowHistory } from "../header";

export type Action = {
  name: string;
  description: string;
  action: () => void;
};

type useActionsProps = {
  enabled?: boolean;
  filter?: string;
};

export const useActions = ({ enabled, filter }: useActionsProps) => {
  const { setPrompt } = useConversationUiStore();
  const actions: Action[] = useMemo(() => {
    const items = [
      {
        name: ":new",
        description: "New conversation",
        action: () => {
          setPrompt("");
          NewConversation();
        },
      },
      {
        name: ":his",
        description: "View conversation history",
        action: () => {
          setPrompt("");
          ShowHistory();
        },
      },
    ];

    return items.filter(
      (item) =>
        enabled &&
        (!filter ||
          item.name.toLowerCase().includes(filter.toLowerCase()) ||
          item.description.toLowerCase().includes(filter.toLowerCase())),
    );
  }, [enabled, filter, setPrompt]);

  return actions;
};
