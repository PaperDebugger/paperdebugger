import { useMemo } from "react";
import { useConversationUiStore } from "../../../stores/conversation/conversation-ui-store";
import { NewConversation, ShowHistory } from "../header";

export type Action = {
  name: string;
  description: string;
  action: () => void;
};

type useActionsProps = {
  enabled?: boolean;
  filter?: string;
  onReviewAndInsert?: () => void;
};

export const useActions = ({ enabled, filter, onReviewAndInsert }: useActionsProps) => {
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
      {
        name: ":review",
        description: "Review paper and insert TeX comments into Overleaf",
        action: () => {
          if (onReviewAndInsert) {
            onReviewAndInsert();
            return;
          }
          setPrompt(
            "Review this paper and add direct comments into the Overleaf TeX source. Use the paper_score and paper_score_comment tools, then insert the generated comments into the paper.",
          );
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
  }, [enabled, filter, onReviewAndInsert, setPrompt]);

  return actions;
};
