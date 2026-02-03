import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { SettingItemSelect } from "../setting-item-select";
import { useSettingStore } from "../../../stores/setting-store";
import { SettingItemInput } from "../setting-item-input";
import { useEffect, useState } from "react";
import apiclient, { apiclientV2, getEndpointFromLocalStorage, resetApiClientEndpoint } from "../../../libs/apiclient";
import { useAdapter } from "../../../adapters/context";

export const UserDeveloperTools = () => {
  const { conversationMode, setConversationMode } = useSettingStore();
  const [endpoint, setEndpoint] = useState(getEndpointFromLocalStorage());
  const adapter = useAdapter();
  const documentId = adapter.getDocumentId?.() || "N/A";

  useEffect(() => {
    apiclient.updateBaseURL(endpoint, "v1");
    apiclientV2.updateBaseURL(endpoint, "v2");
  }, [endpoint]);

  return (
    <SettingsSectionContainer>
      <SettingsSectionTitle>
        <b className="text-blue-600 dark:text-blue-400">Developer</b> Tools *
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

      <div className="flex flex-row gap-2 w-full bg-content2 rounded-medium p-1 items-center">
        <div className="flex flex-col gap-0 w-full pl-3 pt-1 pb-1">
          <p className="text-xs">Document ID</p>
          <p className="text-xs text-gray-500 dark:text-default-500 font-mono select-all">{documentId}</p>
        </div>
      </div>

      <div className="text-gray-500 text-xs ps-2">
        * developer settings stored locally, will be reset when you clear your browser data
      </div>
    </SettingsSectionContainer>
  );
};
