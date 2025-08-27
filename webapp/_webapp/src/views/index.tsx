import { cn, Tooltip } from "@heroui/react";
import { Rnd } from "react-rnd";
import { useCallback, useState, useEffect, useMemo } from "react";
import { PaperDebugger } from "../paperdebugger";
import { createPortal } from "react-dom";

import { COLLAPSED_HEIGHT, useConversationUiStore } from "../stores/conversation/conversation-ui-store";
import { Icon } from "@iconify/react/dist/iconify.js";
import { debounce } from "../libs/helpers";
import { Login } from "./login";
import { PdAppContainer } from "../components/pd-app-container";
import { PdAppControlTitleBar } from "../components/pd-app-control-title-bar";
import { PdAppSmallControlButton } from "../components/pd-app-small-control-button";
import { useAuthStore } from "../stores/auth-store";

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
    </div>
  );
};

const WindowController = () => {
  const { sidebarCollapsed, setSidebarCollapsed, setIsOpen } = useConversationUiStore();
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
            <Tooltip
              content={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              placement="bottom"
              className="noselect"
              size="sm"
              delay={500}
            >
              <PdAppSmallControlButton onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                <Icon
                  icon={sidebarCollapsed ? "tabler:layout-sidebar-left-expand" : "tabler:layout-sidebar-left-collapse"}
                  fontSize={18}
                />
              </PdAppSmallControlButton>
            </Tooltip>
          </div>
        </div>
      </PdAppControlTitleBar>
    );
  }, [sidebarCollapsed, setSidebarCollapsed, setIsOpen]);
  return CompactHeader;
};

const Body = () => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated() ? <PaperDebugger /> : <Login />;
};

export const MainDrawer = () => {
  const { displayMode, isOpen } = useConversationUiStore();
  const { floatingWidth, floatingHeight, setFloatingWidth, setFloatingHeight } = useConversationUiStore();
  const { floatingX, floatingY, setFloatingX, setFloatingY } = useConversationUiStore();
  const { rightFixedWidth, bottomFixedHeight, setRightFixedWidth, setBottomFixedHeight, setHeightCollapseRequired } =
    useConversationUiStore();
  const [dragging, setDragging] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Layout configs for each mode
  type RndProps = React.ComponentProps<typeof Rnd>;
  let rndProps: Partial<RndProps> = {};

  if (displayMode === "floating") {
    rndProps = {
      position: { x: floatingX, y: floatingY },
      size: { width: floatingWidth, height: floatingHeight },
      minWidth: 400,
      minHeight: 320,
      enableResizing: true,
      disableDragging: false,
    };
  } else if (displayMode === "right-fixed") {
    rndProps = {
      default: { x: windowSize.width - rightFixedWidth, y: 0, width: rightFixedWidth, height: windowSize.height },
      position: { x: windowSize.width - rightFixedWidth, y: 0 },
      size: { width: rightFixedWidth, height: windowSize.height },
      minWidth: 400,
      minHeight: 320,
      enableResizing: { left: true, right: false, top: false, bottom: false },
      disableDragging: true,
    };
  } else if (displayMode === "bottom-fixed") {
    rndProps = {
      default: { x: 0, y: windowSize.height - bottomFixedHeight, width: windowSize.width, height: bottomFixedHeight },
      position: { x: 0, y: windowSize.height - bottomFixedHeight },
      size: { width: windowSize.width, height: bottomFixedHeight },
      minWidth: windowSize.width,
      minHeight: 320,
      enableResizing: { left: false, right: false, top: true, bottom: false },
      disableDragging: true,
    };
  }

  const handleResize = useCallback(
    (...args: unknown[]) => {
      const [, , /* _e */ /* _dir */ ref] = args;
      if (ref && ref instanceof HTMLElement && ref.offsetHeight < COLLAPSED_HEIGHT) {
        setHeightCollapseRequired(true);
      } else {
        setHeightCollapseRequired(false);
      }
    },
    [setHeightCollapseRequired],
  );
  const debouncedHandleResize = useMemo(() => debounce(handleResize, 100), [handleResize]);

  return createPortal(
    <Rnd
      id="paper-debugger-rnd"
      cancel=".rnd-cancel"
      className={cn("pd-rnd", isOpen ? "opacity-100 " : "opacity-0 pointer-events-none", dragging && "dragging")}
      {...rndProps}
      style={{
        // visibility: isOpen ? "visible" : "hidden",
        cursor: "default",
        zIndex: 998,
        borderRadius: "0.75rem",
      }}
      bounds="window"
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        if (displayMode === "floating") {
          setFloatingX(position.x);
          setFloatingY(position.y);
          setFloatingWidth(ref.offsetWidth);
          setFloatingHeight(ref.offsetHeight);
        } else if (displayMode === "right-fixed") {
          setRightFixedWidth(ref.offsetWidth);
        } else if (displayMode === "bottom-fixed") {
          setBottomFixedHeight(ref.offsetHeight);
        }
      }}
      onDragStart={() => {
        if (displayMode === "floating") {
          setDragging(true);
        }
      }}
      onDragStop={(_e, _d) => {
        if (displayMode === "floating") {
          setFloatingX(_d.x);
          setFloatingY(_d.y);
          setDragging(false);
        }
      }}
      onResize={(_e, _dir, ref, _delta, position) => {
        debouncedHandleResize(_e, _dir, ref, _delta, position);
        _e.preventDefault();
        _e.stopPropagation();
      }}
      onResizeStart={(_e) => {
        _e.preventDefault();
        _e.stopPropagation();
      }}
      resizeHandleStyles={{
        bottomRight: {
          zIndex: 1002,
          // backgroundColor: "rgba(255, 81, 81, 0.8)",
        },
        bottomLeft: {
          zIndex: 1002,
          // backgroundColor: "rgba(255, 81, 81, 0.8)",
        },
        topRight: {
          zIndex: 1002,
          // backgroundColor: "rgba(255, 81, 81, 0.8)",
        },
        topLeft: {
          zIndex: 1002,
          // backgroundColor: "rgba(255, 81, 81, 0.8)",
        },
        top: {
          zIndex: 1001,
          // backgroundColor: "rgba(81, 107, 255, 0.8)",
        },
        left: {
          zIndex: 1001,
          // backgroundColor: "rgba(81, 107, 255, 0.8)",
        },
        right: {
          zIndex: 1001,
          // backgroundColor: "rgba(81, 107, 255, 0.8)",
        },
        bottom: {
          zIndex: 1001,
          // backgroundColor: "rgba(81, 107, 255, 0.8)",
        },
      }}
    >
      <PdAppContainer>
        <WindowController />
        <Body />
      </PdAppContainer>
    </Rnd>,
    document.body,
  );
};
