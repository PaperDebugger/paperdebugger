import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { useSettingStore } from "../../../stores/setting-store";
import { SettingItem } from "../setting-items";

export const BetaFeatureSettings = () => {
  const { updateSettings, isUpdating, settings } = useSettingStore();

  return (
    <SettingsSectionContainer>
      <SettingsSectionTitle>Beta Features</SettingsSectionTitle>
      <SettingItem
        label="Enable completion"
        description="Predicts your next edit"
        isLoading={isUpdating.enableCompletion}
        selected={settings?.enableCompletion ?? false}
        onSelectChange={(selected) => updateSettings({ enableCompletion: selected })}
      />
      <SettingItem
        hidden
        label="Enable full document RAG"
        description="Enable full document RAG"
        isLoading={isUpdating.fullDocumentRag}
        selected={settings?.fullDocumentRag ?? false}
        onSelectChange={(selected) => updateSettings({ fullDocumentRag: selected })}
      />
    </SettingsSectionContainer>
  );
};
