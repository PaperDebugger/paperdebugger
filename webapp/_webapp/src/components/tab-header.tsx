import { ReactNode } from "react";
import { useConversationUiStore } from "../stores/conversation/conversation-ui-store";
import { useSettingStore } from "../stores/setting-store";

type TabHeaderProps = {
  title: string;
  subTitle: string;
  actions?: ReactNode;
};

export const TabHeader = ({ title, subTitle, actions }: TabHeaderProps) => {
  const { heightCollapseRequired } = useConversationUiStore();
  const { minimalistMode } = useSettingStore();

  const collapsedHeader = (
    <div className="pd-app-tab-content-header collapsed noselect">
      <div className="w-full">{title}</div>
      <div className="flex flex-row gap-2">{actions}</div>
    </div>
  );

  const expandedHeader = (
    <div className="pd-app-tab-content-header noselect">
      <div className="min-w-0">
        <div className="font-bold whitespace-nowrap text-ellipsis overflow-hidden">{title}</div>
        <div className="text-sm text-gray-500 whitespace-nowrap text-ellipsis overflow-hidden w-full noselect">
          {subTitle}
        </div>
      </div>
      <div className="ms-auto flex-shrink-0 flex flex-row gap-2">{actions}</div>
    </div>
  );

  return heightCollapseRequired || minimalistMode ? collapsedHeader : expandedHeader;
};
