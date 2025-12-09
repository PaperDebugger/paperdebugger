import { useMemo } from "react";
import { useConversationUiStore } from "../../../stores/conversation/conversation-ui-store";
import { useSendMessageStream } from "../../../hooks/useSendMessageStream";
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
  const { sendMessageStream } = useSendMessageStream();
  const { inputRef, setPrompt } = useConversationUiStore();
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
        name: ":paper-score",
        description: "Analyze Paper Score",
        action: async () => {
          setPrompt("");
          inputRef?.current?.focus();
          await sendMessageStream("Go through the paper and give me a score of the current paper.", "");
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
  }, [inputRef, enabled, filter, sendMessageStream, setPrompt]);

  return actions;
};
