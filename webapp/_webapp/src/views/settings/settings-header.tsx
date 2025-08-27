import { TabHeader } from "../../components/tab-header";
import { useSettingStore } from "../../stores/setting-store";
import { ChatButton } from "../chat/header/chat-button";

export const SettingsHeader = () => {
  const { resetSettings } = useSettingStore();
  return (
    <TabHeader
      title="Settings"
      subTitle="All settings"
      actions={
        <>
          <ChatButton
            icon="tabler:restore"
            alt="Reset Settings"
            onClick={() => resetSettings()}
            tooltip="Reset Settings"
            disableAnimation
          />
        </>
      }
    />
  );
};
