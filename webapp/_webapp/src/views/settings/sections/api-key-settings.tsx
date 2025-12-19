import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { createSettingsTextInput } from "../setting-text-input";

const ApiKeyInput = createSettingsTextInput("openaiApiKey");

export const ApiKeySettings = () => {
  return (
    <SettingsSectionContainer>
      <SettingsSectionTitle>Bring Your Own Key (BYOK)</SettingsSectionTitle>
      <div className="px-4">
        <ApiKeyInput
          label="OpenAI API Key"
          description="Leave empty to use paperdebugger's API key"
          placeholder="sk-..."
          multiline={false}
          password={true}
        />
      </div>
    </SettingsSectionContainer>
  );
};
