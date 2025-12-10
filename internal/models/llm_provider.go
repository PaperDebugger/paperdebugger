package models

// LLMProviderConfig holds the configuration for LLM API calls.
// If both Endpoint and APIKey are empty, the system default will be used.
type LLMProviderConfig struct {
	Endpoint  string
	APIKey    string
	ModelName string
}

// IsCustom returns true if the user has configured custom LLM provider settings.
func (c *LLMProviderConfig) IsCustom() bool {
	return c != nil && c.APIKey != ""
}

// GetModelName returns the custom model name if set, otherwise returns the default model name.
func (c *LLMProviderConfig) GetModelName(defaultModel string) string {
	if c != nil && c.ModelName != "" {
		return c.ModelName
	}
	return defaultModel
}

// NewLLMProviderConfigFromSettings creates a LLMProviderConfig from user settings.
func NewLLMProviderConfigFromSettings(settings *Settings) *LLMProviderConfig {
	if settings == nil {
		return nil
	}
	return &LLMProviderConfig{
		Endpoint:  settings.LlmProviderEndpoint,
		APIKey:    settings.LlmProviderApiKey,
		ModelName: settings.LlmProviderModel,
	}
}
