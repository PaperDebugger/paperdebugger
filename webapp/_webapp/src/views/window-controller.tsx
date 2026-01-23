import { useMemo } from "react";
import { cn, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { COLLAPSED_HEIGHT, useConversationUiStore } from "../stores/conversation/conversation-ui-store";
import { PdAppControlTitleBar } from "../components/pd-app-control-title-bar";
import { PdAppSmallControlButton } from "../components/pd-app-small-control-button";

export const WindowController = () => {
  const { sidebarCollapsed, setIsOpen } = useConversationUiStore();
  const CompactHeader = useMemo(() => {
    return (
      <PdAppControlTitleBar
        className={cn("border-gray-200 rounded-xl rnd-cancel", sidebarCollapsed ? "collapsed" : "expanded")}
        id="pd-app-header"
      >
        <div className="flex items-center justify-between pl-2 pr-0 py-0">
          <div className="flex flex-row items-center noselect gap-0 rnd-cancel">
            <Tooltip content={"Close"} placement="bottom" className="noselect" size="sm" delay={500}>
              <PdAppSmallControlButton onClick={() => setIsOpen(false)}>
                <Icon icon={"tabler:square-x"} fontSize={16} />
              </PdAppSmallControlButton>
            </Tooltip>
            <PositionController />
          </div>
        </div>
      </PdAppControlTitleBar>
    );
  }, [sidebarCollapsed, setIsOpen]);
  return CompactHeader;
};

const PositionController = () => {
  const {
    sidebarCollapsed,
    floatingHeight,
    bottomFixedHeight,
    setHeightCollapseRequired,
    setDisplayMode,
    displayMode,
  } = useConversationUiStore();
  return (
    <div
      className={cn(
        "flex flex-row items-center noselect gap-0 overflow-clip transition-all duration-[300ms]",
        sidebarCollapsed ? "w-[0%]" : "w-[100%]",
      )}
    >
      <Tooltip content="Floating" placement="bottom" className="noselect" size="sm" delay={500}>
        <PdAppSmallControlButton
          onClick={() => {
            if (floatingHeight < COLLAPSED_HEIGHT) {
              setHeightCollapseRequired(true);
            } else {
              setHeightCollapseRequired(false);
            }
            setDisplayMode("floating");
          }}
        >
          <Icon icon={displayMode === "floating" ? "tabler:app-window-filled" : "tabler:app-window"} fontSize={18} />
        </PdAppSmallControlButton>
      </Tooltip>
      <Tooltip content="Sticky Bottom" placement="bottom" className="noselect" size="sm" delay={500}>
        <PdAppSmallControlButton
          onClick={() => {
            if (bottomFixedHeight < COLLAPSED_HEIGHT) {
              setHeightCollapseRequired(true);
            } else {
              setHeightCollapseRequired(false);
            }
            setDisplayMode("bottom-fixed");
          }}
        >
          <Icon
            icon={displayMode === "bottom-fixed" ? "tabler:layout-bottombar-filled" : "tabler:layout-bottombar"}
            fontSize={18}
          />
        </PdAppSmallControlButton>
      </Tooltip>
      <Tooltip content="Sticky Right" placement="bottom" className="noselect" size="sm" delay={500}>
        <PdAppSmallControlButton
          onClick={() => {
            if (window.innerHeight < COLLAPSED_HEIGHT) {
              setHeightCollapseRequired(true);
            } else {
              setHeightCollapseRequired(false);
            }
            setDisplayMode("right-fixed");
          }}
        >
          <Icon
            icon={displayMode === "right-fixed" ? "tabler:layout-sidebar-right-filled" : "tabler:layout-sidebar-right"}
            fontSize={18}
          />
        </PdAppSmallControlButton>
      </Tooltip>
      <Tooltip content="Embed Sidebar" placement="bottom" className="noselect" size="sm" delay={500}>
        <PdAppSmallControlButton
          onClick={() => {
            setDisplayMode("embed");
          }}
        >
          <Icon
            icon={
              displayMode === "embed"
                ? "tabler:layout-sidebar-right-collapse-filled"
                : "tabler:layout-sidebar-right-collapse"
            }
            fontSize={18}
          />
        </PdAppSmallControlButton>
      </Tooltip>
    </div>
  );
};
