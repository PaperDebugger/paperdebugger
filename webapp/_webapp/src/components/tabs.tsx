import { cn, Tab, Tabs as NextTabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ReactNode, forwardRef, useImperativeHandle, useCallback } from "react";
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

export const Tabs = forwardRef<TabRef, TabProps>(({ items }, ref) => {
  const { user } = useAuthStore();
  const { activeTab, setActiveTab, sidebarCollapsed } = useConversationUiStore();
  const { hideAvatar } = useSettingStore();

  useImperativeHandle(ref, () => ({
    setSelectedTab: setActiveTab,
  }));

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
        className={cn("pd-app-tab-items noselect transition-all duration-300", sidebarCollapsed ? "w-16" : "w-[140px]")}
      >
        {!hideAvatar && <Avatar name={user?.name || "User"} src={user?.picture} className="pd-avatar" />}

        <NextTabs
          aria-label="Options"
          isVertical
          variant="light"
          classNames={{
            tabList: "bg-gray-100",
            tab: "justify-start",
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
