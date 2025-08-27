import { Icon } from "@iconify/react/dist/iconify.js";
import { useTrackableDisclosure } from "../../../../hooks/useTrackableDisclosure";
import { useSelectionStore } from "../../../../stores/selection-store";
import { SelectedTextModal } from "./modal";
import { cn, Tooltip } from "@heroui/react";
import { useConversationUiStore } from "../../../../stores/conversation/conversation-ui-store";
import { useSettingStore } from "../../../../stores/setting-store";

export const SelectedTextIndicator = () => {
  const { heightCollapseRequired } = useConversationUiStore();
  const selectedText = useSelectionStore((s) => s.selectedText);
  const clear = useSelectionStore((s) => s.clear);
  const { isOpen, onOpen, onClose } = useTrackableDisclosure({ name: "promptInput" });
  const { minimalistMode } = useSettingStore();
  return (
    <div className="px-2 relative" onClick={onOpen}>
      <div
        className={cn(
          "pd-selected-text-indicator",
          heightCollapseRequired || minimalistMode ? "px-2 py-1 text-[0.65rem]" : "p-2 text-xs",
        )}
        style={{ animation: "blink 0.5s ease-in-out" }}
      >
        <span className="font-bold">Selected Text: </span>
        {selectedText}
      </div>
      <SelectedTextModal isOpen={isOpen} onOpenChange={onOpen} onClose={onClose} />
      <Tooltip content="Clear selected text" className="noselect" placement="bottom" size="sm" delay={500}>
        <div className="pd-selected-text-indicator-clear" onMouseDown={(e) => e.stopPropagation()} onClick={clear}>
          <Icon icon="tabler:x" />
        </div>
      </Tooltip>
    </div>
  );
};
