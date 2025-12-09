import { Button, Input, Textarea } from "@heroui/react";
import { useCreatePromptMutation, useDeletePromptMutation, useUpdatePromptMutation } from "../../query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Prompt } from "../../pkg/gen/apiclient/user/v1/user_pb";
import { Modal } from "../../components/modal";
import { usePromptLibraryStore } from "../../stores/prompt-library-store";

type PromptModalProps = {
  mode: "create" | "update" | "view" | "delete";
  prompt?: Prompt;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
};

export const PromptModal = ({ mode, prompt, isOpen, onOpenChange, onClose }: PromptModalProps) => {
  const { loadPrompts } = usePromptLibraryStore();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { mutateAsync: createPrompt } = useCreatePromptMutation();
  const { mutateAsync: updatePrompt } = useUpdatePromptMutation();
  const { mutateAsync: deletePrompt } = useDeletePromptMutation();

  const modalTitle = useMemo(() => {
    if (mode == "create") {
      return "Create Prompt";
    } else if (mode == "update") {
      return "Update Prompt";
    } else if (mode == "view") {
      return "View Prompt";
    } else if (mode == "delete") {
      return "Delete Prompt";
    }
    return "";
  }, [mode]);

  useEffect(() => {
    setTitle(prompt?.title || "");
    setContent(prompt?.content || "");
  }, [prompt]);

  const handleCreate = useCallback(async () => {
    setIsSubmitting(true);
    await createPrompt({
      title,
      content,
    });
    await loadPrompts();
    setIsSubmitting(false);
    onClose?.();
    setTitle("");
    setContent("");
  }, [createPrompt, onClose, title, content, loadPrompts, setIsSubmitting]);

  const handleUpdate = useCallback(async () => {
    setIsSubmitting(true);
    await updatePrompt({
      promptId: prompt?.id || "",
      title,
      content,
    });
    await loadPrompts();
    setIsSubmitting(false);
    onClose?.();
  }, [updatePrompt, onClose, prompt?.id, title, content, loadPrompts, setIsSubmitting]);

  const handleDelete = useCallback(async () => {
    setIsSubmitting(true);
    await deletePrompt({
      promptId: prompt?.id || "",
    });
    await loadPrompts();
    setIsSubmitting(false);
    onClose?.();
  }, [deletePrompt, onClose, prompt?.id, loadPrompts, setIsSubmitting]);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      header={<>{modalTitle}</>}
      footer={
        <>
          <Button
            size="sm"
            variant="flat"
            onPress={() => {
              setTitle("");
              setContent("");
              onClose?.();
            }}
          >
            Close
          </Button>
          {mode == "create" && (
            <Button
              size="sm"
              color="primary"
              isLoading={isSubmitting}
              isDisabled={isSubmitting || !title || !content}
              onPress={handleCreate}
            >
              Create
            </Button>
          )}
          {mode == "update" && (
            <Button
              size="sm"
              color="primary"
              isLoading={isSubmitting}
              isDisabled={isSubmitting || !title || !content || !prompt?.id}
              onPress={handleUpdate}
            >
              Update
            </Button>
          )}
          {mode == "delete" && (
            <Button size="sm" color="danger" isLoading={isSubmitting} isDisabled={isSubmitting} onPress={handleDelete}>
              Delete
            </Button>
          )}
        </>
      }
    >
      <div className="w-full flex flex-col gap-2">
        <Input
          label="Title"
          variant="bordered"
          color="primary"
          radius="sm"
          placeholder="Enter a title for your prompt"
          value={title}
          required
          onChange={(e) => setTitle(e.target.value)}
          classNames={{
            input: "text-xs",
          }}
          isReadOnly={mode == "view" || mode == "delete"}
        />
        <Textarea
          label="Content"
          variant="bordered"
          color="primary"
          radius="sm"
          placeholder="Enter a content for your prompt"
          value={content}
          rows={8}
          required
          onChange={(e) => setContent(e.target.value)}
          classNames={{
            input: "text-xs",
          }}
          isReadOnly={mode == "view" || mode == "delete"}
        />
      </div>
    </Modal>
  );
};
