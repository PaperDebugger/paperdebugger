import { cn, Tab, Tabs as NextTabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ReactNode, forwardRef, useImperativeHandle, useCallback, useRef, useEffect } from "react";
import { useConversationUiStore } from "../stores/conversation/conversation-ui-store";
import { useAuthStore } from "../stores/auth-store";
import { Avatar } from "./avatar";
import { useSettingStore } from "../stores/setting-store";

type TabItem = {
  key: string;
  title: string;
  icon: string;
  children?: ReactNode;
  tooltip?: string;
};

type TabRef = {
  setSelectedTab: (key: string) => void;
};

type TabProps = {
  items: TabItem[];
};

// Constants for width limits
const MIN_TAB_ITEMS_WIDTH = 64; // Minimum width (w-16 = 64px)
const MAX_TAB_ITEMS_WIDTH = 200; // Maximum width
const COLLAPSE_THRESHOLD = 113; // Width threshold to auto-collapse text

export const Tabs = forwardRef<TabRef, TabProps>(({ items }, ref) => {
  const { user } = useAuthStore();
  const { 
    activeTab, 
    setActiveTab, 
    sidebarCollapsed, 
    setSidebarCollapsed,
    tabItemsWidth,
    setTabItemsWidth
  } = useConversationUiStore();
  const { hideAvatar } = useSettingStore();
  const { minimalistMode } = useSettingStore();
  
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const tabItemsWidthRef = useRef(tabItemsWidth);
  const mouseMoveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const mouseUpHandlerRef = useRef<(() => void) | null>(null);

  // Keep ref in sync with tabItemsWidth
  useEffect(() => {
    tabItemsWidthRef.current = tabItemsWidth;
  }, [tabItemsWidth]);

  // Auto-collapse based on width
  useEffect(() => {
    const shouldCollapse = tabItemsWidth < COLLAPSE_THRESHOLD;
    // Get current state to avoid stale closure
    const currentCollapsed = useConversationUiStore.getState().sidebarCollapsed;
    // Only update if the state doesn't match the desired state
    if (shouldCollapse !== currentCollapsed) {
      setSidebarCollapsed(shouldCollapse);
    }
  }, [tabItemsWidth, setSidebarCollapsed]); // Only depend on tabItemsWidth to avoid loops

  useImperativeHandle(ref, () => ({
    setSelectedTab: setActiveTab,
  }));

  // Cleanup function to reset resize state and remove event listeners
  const cleanupResizeState = useCallback(() => {
    isResizingRef.current = false;
    document.body.style.cursor = "default";
    document.body.style.userSelect = "";
    if (resizeHandleRef.current) {
      resizeHandleRef.current.classList.remove("resizing");
    }
    // Remove event listeners if they exist
    if (mouseMoveHandlerRef.current) {
      document.removeEventListener("mousemove", mouseMoveHandlerRef.current);
      mouseMoveHandlerRef.current = null;
    }
    if (mouseUpHandlerRef.current) {
      document.removeEventListener("mouseup", mouseUpHandlerRef.current);
      mouseUpHandlerRef.current = null;
    }
  }, []);

  // Cleanup on unmount to prevent leaks if component unmounts during resize
  useEffect(() => {
    return () => {
      if (isResizingRef.current) {
        cleanupResizeState();
      }
    };
  }, [cleanupResizeState]);

  // Handle resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = tabItemsWidthRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      e.preventDefault();
      const delta = e.clientX - startX;
      const newWidth = Math.max(MIN_TAB_ITEMS_WIDTH, Math.min(MAX_TAB_ITEMS_WIDTH, startWidth + delta));
      setTabItemsWidth(newWidth);
    };

    const handleMouseUp = () => {
      cleanupResizeState();
    };

    // Store handlers in refs so they can be cleaned up on unmount
    mouseMoveHandlerRef.current = handleMouseMove;
    mouseUpHandlerRef.current = handleMouseUp;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    if (resizeHandleRef.current) {
      resizeHandleRef.current.classList.add("resizing");
    }
  }, [setTabItemsWidth, cleanupResizeState]);

  const renderTabItem = useCallback(
    (item: TabItem) => {
      const tabTitle = (
        <div className="flex flex-row items-center space-x-2" id="pd-tab-item">
          <div className="flex flex-col items-center justify-center flex-1 h-full">
            <Icon className="transition-all duration-300" icon={item.icon} fontSize={18} />
          </div>
          <div
            className={cn(
              "transition-all duration-300 whitespace-nowrap overflow-hidden",
              sidebarCollapsed ? "opacity-0 max-w-0 !mx-0" : "opacity-100 max-w-[100px]",
            )}
          >
            {item.title}
          </div>
        </div>
      );
      return <Tab key={item.key} title={tabTitle} />;
    },
    [sidebarCollapsed],
  );

  return (
    <>
      <div 
        className="pd-app-tab-items noselect relative"
        style={{ width: `${tabItemsWidth}px` }}
      >
        {/* Resize handle on the right edge */}
        <div
          ref={resizeHandleRef}
          className="pd-tab-items-resize-handle"
          onMouseDown={handleMouseDown}
        >
          {/* Visual indicator line */}
          <div className="resize-handle-indicator" />
        </div>

        {!hideAvatar && <Avatar name={user?.name || "User"} src={user?.picture} className="pd-avatar" />}

        <NextTabs
          aria-label="Options"
          isVertical
          variant="light"
          classNames={{
            tabList: "bg-gray-100 dark:!bg-default-100",
            tab: cn("justify-start", minimalistMode ? "text-xs" : ""),
          }}
          selectedKey={activeTab}
          onSelectionChange={(e) => {
            setActiveTab(e as string);
          }}
        >
          {items.map((item) => renderTabItem(item))}
        </NextTabs>

        <div className="flex-1"></div>
        <div className={cn("pd-bottom-logo-group", sidebarCollapsed ? "text-[8px]" : "text-md px-3")}>
          <span className="!font-light">Paper</span>
          <span className="!font-bold">Debugger</span>
        </div>
      </div>
      {items.find((item) => item.key === activeTab)?.children}
    </>
  );
});
