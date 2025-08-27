import { Button } from "@heroui/react";
import { CodeBlock } from "../../../../components/code-block";
import { useSelectionStore } from "../../../../stores/selection-store";
import { Modal } from "../../../../components/modal";

type SelectedTextModalProps = {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
};

export const SelectedTextModal = ({ isOpen, onOpenChange, onClose }: SelectedTextModalProps) => {
  const selectedText = useSelectionStore((s) => s.selectedText);
  const clear = useSelectionStore((s) => s.clear);

  return (
    <Modal
      disableAnimation
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      header={<>Selected Text</>}
      footer={
        <>
          <Button size="sm" variant="flat" onPress={onClose}>
            Close
          </Button>
          <Button size="sm" variant="flat" onPress={clear} color="danger">
            Clear
          </Button>
        </>
      }
    >
      <CodeBlock code={selectedText ?? ""} />
    </Modal>
  );
};
