import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { createSettingsTextInput } from "../setting-text-input";

const ApiKeyInput = createSettingsTextInput("llmProviderApiKey");
const EndpointInput = createSettingsTextInput("llmProviderEndpoint");


export const LLMProviderSettings = () => {
  return (
    <SettingsSectionContainer>
      <SettingsSectionTitle tooltip="LLM Provider must be OpenAI compatible. To use Agent Workflow, we will store the endpoint and API key in our server">
        LLM Provider
      </SettingsSectionTitle>
      <div className="px-4">
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
          password={true}
        />
      </div>
    </SettingsSectionContainer>
  );
};
