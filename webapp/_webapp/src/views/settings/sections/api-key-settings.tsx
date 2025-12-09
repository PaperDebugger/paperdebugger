import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { createSettingsTextInput } from "../setting-text-input";

const ApiKeyInput = createSettingsTextInput("llmProviderApiKey");
const EndpointInput = createSettingsTextInput("llmProviderEndpoint");


export const LLMProviderSettings = () => {
  return (
    <SettingsSectionContainer>
      <SettingsSectionTitle>LLM Provider</SettingsSectionTitle>
      <div style={{ padding: "12px" }}>
        <EndpointInput
          label="Endpoint"
          description="Custom LLM provider endpoint URL"
          placeholder="e.g., https://api.openai.com/v1"
          multiline={false}
        />
        <ApiKeyInput
          label="API Key"
          description="Your LLM provider API key (will be stored securely)"
          placeholder="sk-..."
          multiline={false}
        />
      </div>
    </SettingsSectionContainer>
  );
};
