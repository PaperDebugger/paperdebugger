import { cn } from "@heroui/react";
import { Rnd } from "react-rnd";
import { useCallback, useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

import { COLLAPSED_HEIGHT, useConversationUiStore } from "../stores/conversation/conversation-ui-store";
import { debounce } from "../libs/helpers";
import { PdAppContainer } from "../components/pd-app-container";
import { useSettingStore } from "../stores/setting-store";
import { WindowController } from "./window-controller";
import { Body } from "./body";
import { EmbedSidebar } from "./embed-sidebar";


export const MainDrawer = () => {
  const { displayMode, isOpen } = useConversationUiStore();
  const { floatingWidth, floatingHeight, setFloatingWidth, setFloatingHeight } = useConversationUiStore();
  const { floatingX, floatingY, setFloatingX, setFloatingY } = useConversationUiStore();
  const { rightFixedWidth, bottomFixedHeight, setRightFixedWidth, setBottomFixedHeight, setHeightCollapseRequired } =
    useConversationUiStore();
  const { allowOutOfBounds } = useSettingStore();
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

  // Handle embed mode separately
  if (displayMode === "embed") {
    return <EmbedSidebar />;
  }

  // Handle other modes with Rnd

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
  } else if (displayMode === "fullscreen") {
    rndProps = {
      default: { x: 0, y: 0, width: windowSize.width, height: windowSize.height },
      position: { x: 0, y: 0 },
      size: { width: windowSize.width, height: windowSize.height },
      minWidth: windowSize.width,
      minHeight: windowSize.height,
      enableResizing: { left: false, right: false, top: false, bottom: false },
      disableDragging: true,
    };
  }

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
      bounds={allowOutOfBounds ? undefined : "window"}
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
      <PdAppContainer
        style={{
          borderRadius: displayMode == "fullscreen" ? "0" : undefined,
          border: displayMode == "fullscreen" ? "none" : undefined,
        }}
      >
        {displayMode !== "fullscreen" && <WindowController />}
        <Body />
      </PdAppContainer>
    </Rnd>,
    document.body,
  );
};
