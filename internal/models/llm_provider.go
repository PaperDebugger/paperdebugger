package models

// LLMProviderConfig holds the configuration for LLM API calls.
// If both Endpoint and APIKey are empty, the system default will be used.
type LLMProviderConfig struct {
	Endpoint      string
	APIKey        string
	ModelName     string
	IsCustomModel bool
}

// IsCustom returns true if the user has configured custom LLM provider settings.
func (c *LLMProviderConfig) IsCustom() bool {
	return c != nil && c.APIKey != ""
}
