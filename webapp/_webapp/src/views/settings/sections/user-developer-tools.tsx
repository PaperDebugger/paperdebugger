import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { SettingItemSelect } from "../setting-item-select";
import { useSettingStore } from "../../../stores/setting-store";
import { SettingItemInput } from "../setting-item-input";
import { useEffect, useState } from "react";
import apiclient, { getEndpointFromLocalStorage, resetApiClientEndpoint } from "../../../libs/apiclient";

export const UserDeveloperTools = () => {
  const { conversationMode, setConversationMode } = useSettingStore();
  const [endpoint, setEndpoint] = useState(getEndpointFromLocalStorage());

  useEffect(() => {
    apiclient.updateBaseURL(endpoint);
  }, [endpoint]);

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
        onChange={setEndpoint}
        showResetButton={true}
        onReset={() => {
          resetApiClientEndpoint();
          setEndpoint(getEndpointFromLocalStorage());
        }}
      />

      <div className="text-gray-500 text-xs ps-2">
        * developer settings stored locally, will be reset when you clear your browser data
      </div>
    </SettingsSectionContainer>
  );
};
