import { useEffect, useRef, useState } from "react";
import { SettingItemInput } from "../settings/setting-item-input";
import apiclient, { apiclientV2, getEndpointFromLocalStorage, resetApiClientEndpoint } from "../../libs/apiclient";
import { useAuthStore } from "../../stores/auth-store";

export default function AdvancedSettings() {
  const [endpoint, setEndpoint] = useState(() => getEndpointFromLocalStorage());
  const [infoMessage, setInfoMessage] = useState("");
  const { logout } = useAuthStore();
  const previousEndpointRef = useRef(endpoint);

  useEffect(() => {
    apiclient.updateBaseURL(endpoint, "v1");
    apiclientV2.updateBaseURL(endpoint, "v2");

    if (previousEndpointRef.current !== endpoint) {
      previousEndpointRef.current = endpoint;
      setInfoMessage("Endpoint changed. Please sign in again for this backend.");
      logout().catch(() => {
        // Best effort: local auth state is still cleared even if backend logout fails.
      });
    }
  }, [endpoint]);

  return (
    <div className="flex flex-col gap-2 p-8 border !border-gray-200 dark:!border-default-200 rounded-lg my-4">
      <h1 className="text-default-700 dark:!text-default-700">Advanced Options</h1>
      <SettingItemInput
        label="Endpoint"
        description="You need to refresh the page to apply the changes"
        value={endpoint}
        onChange={setEndpoint}
        showResetButton={true}
        onReset={() => {
          resetApiClientEndpoint();
          setEndpoint(getEndpointFromLocalStorage());
          setInfoMessage("");
        }}
      />
      <p className="text-xs text-gray-500 dark:text-default-500">
        Changing the endpoint invalidates the current PaperDebugger login session. You need to log in again on the
        selected backend.
      </p>
      {infoMessage ? <p className="text-xs text-primary-600 dark:text-primary-400">{infoMessage}</p> : null}
    </div>
  );
}
