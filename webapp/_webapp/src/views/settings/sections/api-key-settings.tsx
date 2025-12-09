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
          description="Leave empty to use default endpoint"
          placeholder="e.g., https://api.openai.com/v1"
          multiline={false}
        />
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
