import { useEffect, useState } from "react";
import { SettingItemInput } from "../settings/setting-item-input";
import apiclient, { apiclientV2, getEndpointFromLocalStorage, resetApiClientEndpoint } from "../../libs/apiclient";

export default function AdvancedSettings() {
  const [endpoint, setEndpoint] = useState(getEndpointFromLocalStorage());

  useEffect(() => {
    apiclient.updateBaseURL(endpoint, "v1");
    apiclientV2.updateBaseURL(endpoint, "v2");
  }, [endpoint]);

  return (
    <div className="flex flex-col gap-2 p-8 border border-gray-200! dark:border-default-200! rounded-lg my-4">
      <h1 className="text-default-700 dark:text-default-700!">Advanced Options</h1>
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
