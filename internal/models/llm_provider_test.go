package models

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsMiniMaxModel(t *testing.T) {
	tests := []struct {
		slug     string
		expected bool
	}{
		{"MiniMax-M2.7", true},
		{"MiniMax-M2.7-highspeed", true},
		{"minimax/MiniMax-M2.7", true},
		{"minimax/MiniMax-M2.7-highspeed", true},
		{"MINIMAX-M2.7", true},
		{"gpt-5.1", false},
		{"openai/gpt-5.1", false},
		{"qwen/qwen-plus", false},
		{"google/gemini-2.5-flash", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.slug, func(t *testing.T) {
			result := IsMiniMaxModel(tt.slug)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestLLMProviderConfig_IsCustom(t *testing.T) {
	tests := []struct {
		name     string
		config   *LLMProviderConfig
		expected bool
	}{
		{"nil config", nil, false},
		{"empty config", &LLMProviderConfig{}, false},
		{"with API key", &LLMProviderConfig{APIKey: "sk-test"}, true},
		{"with endpoint only", &LLMProviderConfig{Endpoint: "https://api.example.com"}, false},
		{"with both", &LLMProviderConfig{APIKey: "sk-test", Endpoint: "https://api.example.com"}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.config.IsCustom()
			assert.Equal(t, tt.expected, result)
		})
	}
}
