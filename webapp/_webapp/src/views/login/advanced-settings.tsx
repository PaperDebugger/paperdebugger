import { useSettingStore } from "../../stores/setting-store";
import { SettingItemInput } from "../settings/setting-item-input";

export default function AdvancedSettings() {
  const { endpoint, setEndpoint, resetEndpoint } = useSettingStore();

  return (
    <div className="flex flex-col gap-2 p-8 border border-gray-200 rounded-lg my-4">
      <h1>Advanced Settings</h1>
      <SettingItemInput
        label="Endpoint"
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
    </div>
  );
}
