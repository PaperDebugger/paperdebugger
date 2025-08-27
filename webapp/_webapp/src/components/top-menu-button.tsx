import { useEffect, useState } from "react";
import { Browser, getBrowser } from "../libs/browser";
import { Logo } from "./logo";
import { useConversationUiStore } from "../stores/conversation/conversation-ui-store";
import { useSettingStore } from "../stores/setting-store";

export const TopMenuButton = () => {
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const { settings } = useSettingStore();
  const { isOpen, setIsOpen, resetPosition } = useConversationUiStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const contextMenu = document.querySelector(".pd-context-menu");
      const button = document.getElementById("paper-debugger-button");

      if (contextMenuVisible && contextMenu && button) {
        // Check if click is outside both the context menu and the button
        if (!contextMenu.contains(target) && !button.contains(target)) {
          setContextMenuVisible(false);
        }
      }
    };

    if (contextMenuVisible) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contextMenuVisible]);

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenuVisible(true);
  };

  const handleResetPosition = () => {
    setIsOpen(true);
    resetPosition();
    setContextMenuVisible(false);
  };

  return (
    <div
      className="toolbar-item dropdown relative"
      id="paper-debugger-button"
      onContextMenu={(event) => handleContextMenu(event)}
    >
      <button
        className="btn btn-full-height flex gap-1 items-center justify-center ide-redesign-toolbar-dropdown-toggle-subdued ide-redesign-toolbar-button-subdued menu-bar-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Logo className="bg-transparent p-0 m-0 flex items-center justify-center w-6 h-6 align-middle" />
        <p className={`text-exo-2 toolbar-label ${settings?.fullWidthPaperDebuggerButton ? "" : "hidden"}`}>
          <span className="font-light">Paper</span>
          <span className="font-bold">Debugger</span>
          <span className="text-xs text-white bg-gray-700 rounded-md px-2 py-1 ms-2">
            {getBrowser() === Browser.Chrome ? "⌘ + L" : "⌃ + L"}
          </span>
        </p>
      </button>
      {/* 位置重置菜单 */}
      <div
        className={`pd-context-menu noselect ${contextMenuVisible ? "show" : ""}`}
        style={{
          zIndex: 998,
        }}
      >
        <div className="pd-context-menu-item-group">
          <p className="text-xs text-gray-400 px-2">If you can't find the PaperDebugger window, try to:</p>
          <div className="pd-context-menu-item noselect" onClick={handleResetPosition}>
            <p>Reset Position</p>
          </div>
        </div>
      </div>
    </div>
  );
};
