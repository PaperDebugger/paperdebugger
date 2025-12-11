import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { createSettingsTextInput } from "../setting-text-input";

const ApiKeyInput = createSettingsTextInput("openaiApiKey");


export const ApiKeySettings = () => {
  return (
    <SettingsSectionContainer>
      <SettingsSectionTitle>
        LLM Provider
      </SettingsSectionTitle>
      <div className="px-4">
        <ApiKeyInput
          label="API Key"
          description="Leave empty to use default API key"
          placeholder="sk-..."
          multiline={false}
          password={true}
        />
      </div>
    </SettingsSectionContainer>
  );
};
