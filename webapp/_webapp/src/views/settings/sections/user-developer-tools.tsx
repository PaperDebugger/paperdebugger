import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { SettingItemSelect } from "../setting-item-select";
import { useSettingStore } from "../../../stores/setting-store";

export const UserDeveloperTools = () => {
  const { conversationMode, setConversationMode } = useSettingStore();

  return (
    <SettingsSectionContainer>
      <SettingsSectionTitle>
        <b className="text-blue-600">Developer</b> Tools *
      </SettingsSectionTitle>

      <SettingItemSelect
        label="Conversation Mode"
        description="Affets the message sent to AI"
        selected={conversationMode}
        options={{
          "debug": "Debug",
          "normal": "Normal",
        }}
        onSelectChange={(selected) => {
          setConversationMode(selected as "debug" | "normal")
        }}
      />

      <div className="text-gray-500 text-xs ps-2">* developer settings stored locally, will be reset when you clear your browser data</div>
    </SettingsSectionContainer>
  );
};