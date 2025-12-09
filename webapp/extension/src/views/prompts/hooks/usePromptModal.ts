import { useCallback, useState } from "react";
import { Prompt } from "../../../pkg/gen/apiclient/user/v1/user_pb";
import { useTrackableDisclosure } from "../../../hooks/useTrackableDisclosure";

export function usePromptModal() {
  const [mode, setMode] = useState<"create" | "update" | "view" | "delete">("create");
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | undefined>(undefined);
  const { isOpen, onOpen, onClose } = useTrackableDisclosure({
    name: "promptmodal",
  });

  const onCreateOpen = useCallback(() => {
    setMode("create");
    setSelectedPrompt(undefined);
    onOpen();
  }, [onOpen]);

  const onUpdateOpen = useCallback(
    (prompt: Prompt) => {
      setMode("update");
      setSelectedPrompt(prompt);
      onOpen();
    },
    [onOpen],
  );

  const onViewOpen = useCallback(
    (prompt: Prompt) => {
      setMode("view");
      setSelectedPrompt(prompt);
      onOpen();
    },
    [onOpen],
  );

  const onDeleteOpen = useCallback(
    (prompt: Prompt) => {
      setMode("delete");
      setSelectedPrompt(prompt);
      onOpen();
    },
    [onOpen],
  );

  return {
    mode,
    selectedPrompt,
    isOpen,
    onOpen,
    onClose,
    onCreateOpen,
    onUpdateOpen,
    onViewOpen,
    onDeleteOpen,
  };
}
