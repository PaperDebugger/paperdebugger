import { useSettingStore } from "../../../stores/setting-store";
import { useEffect, useState } from "react";
import apiclient, { apiclientV2, getEndpointFromLocalStorage, resetApiClientEndpoint } from "../../../libs/apiclient";
import { useAdapter } from "../../../adapters/context";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { SettingsSegmentedControl } from "@/components/settings/SettingsSegmentedControl";
import { SettingsInput } from "@/components/settings/SettingsInput";
import { Button } from "@/components/ui/button";
import { Code } from "lucide-react";

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
    <SettingsSection title="Developer Tools" icon={<Code className="w-4 h-4" />} variant="info">
      <SettingsCard divided>
        <SettingsRow label={
          conversationMode === "debug" ? "Chat Without Document" : "Chat With Document"
        }>
          <SettingsSegmentedControl
            value={conversationMode}
            onValueChange={setConversationMode}
            options={[
              { value: "debug", label: "Without" },
              { value: "normal", label: "With" },
            ]}
          />
        </SettingsRow>

        <div className="px-4 py-3.5">
          <SettingsInput
            label="Backend Endpoint"
            description="You need to refresh the page to apply the changes"
            value={endpoint}
            onChange={setEndpoint}
            placeholder="https://api.paperdebugger.com"
          />
          <div className="flex flex-row justify-between items-center mt-3.5">
            <span className="text-xs text-muted-foreground">Current Value: {endpoint}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                resetApiClientEndpoint();
                setEndpoint(getEndpointFromLocalStorage());
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <SettingsRow label="Document ID">
          <span className="text-xs text-muted-foreground text-mono select-all">{documentId}</span>
        </SettingsRow>
      </SettingsCard>
      <div className="text-xs text-muted-foreground">
        * developer settings stored locally, will be reset when you clear your browser data
      </div>
    </SettingsSection>
  );
};
