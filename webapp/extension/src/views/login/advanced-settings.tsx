import { useEffect, useState } from "react";
import { SettingItemInput } from "../settings/setting-item-input";
import apiclient, { getEndpointFromLocalStorage, resetApiClientEndpoint } from "../../libs/apiclient";

export default function AdvancedSettings() {
  const [endpoint, setEndpoint] = useState(getEndpointFromLocalStorage());

  useEffect(() => {
    apiclient.updateBaseURL(endpoint);
  }, [endpoint]);

  return (
    <div className="flex flex-col gap-2 p-8 border border-gray-200 rounded-lg my-4">
      <h1>Advanced Settings</h1>
      <SettingItemInput
        label="Endpoint"
        description="You need to refresh the page to apply the changes"
        value={endpoint}
        onChange={setEndpoint}
        showResetButton={true}
        onReset={() => {
          resetApiClientEndpoint();
          setEndpoint(getEndpointFromLocalStorage());
        }}
      />
    </div>
  );
}
