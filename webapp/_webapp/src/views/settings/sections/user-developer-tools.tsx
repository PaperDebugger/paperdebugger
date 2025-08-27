import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { SettingItemSelect } from "../setting-item-select";
import { useSettingStore } from "../../../stores/setting-store";
import { SettingItemInput } from "../setting-item-input";

export const UserDeveloperTools = () => {
  const { conversationMode, setConversationMode } = useSettingStore();
  const { endpoint, setEndpoint, resetEndpoint } = useSettingStore();
  return (
    <SettingsSectionContainer>
      <SettingsSectionTitle>
        <b className="text-blue-600">Developer</b> Tools *
      </SettingsSectionTitle>

      <SettingItemSelect
        label="Conversation Mode"
        description="Affects the message sent to AI"
        selected={conversationMode}
        options={{
          debug: "Debug",
          normal: "Normal",
        }}
        onSelectChange={(selected) => {
          setConversationMode(selected as "debug" | "normal");
        }}
      />

      <SettingItemInput
        label="Backend Endpoint"
        description="You need to refresh the page to apply the changes"
        value={endpoint}
        onChange={(value) => {
          setEndpoint(value);
        }}
        showResetButton={true}
        onReset={() => {
          resetEndpoint();
        }}
      />

      <div className="text-gray-500 text-xs ps-2">
        * developer settings stored locally, will be reset when you clear your browser data
      </div>
    </SettingsSectionContainer>
  );
};
