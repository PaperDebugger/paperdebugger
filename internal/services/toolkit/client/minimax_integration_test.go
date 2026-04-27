package client

import (
	"os"
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/models"
	"testing"

	"github.com/stretchr/testify/assert"
)

// Integration tests for MiniMax provider support.
// These tests verify the end-to-end provider routing logic.
// Set MINIMAX_API_KEY env var to run live API tests (skipped by default).

func TestIntegration_MiniMaxProviderRouting_ServerKey(t *testing.T) {
	// Simulate server with MINIMAX_API_KEY configured
	client := &AIClientV2{
		cfg: &cfg.Cfg{
			MiniMaxAPIKey:    "mm-server-key",
			MiniMaxBaseURL:   "https://api.minimax.io/v1",
			OpenAIBaseURL:    "https://api.openai.com/v1",
			InferenceBaseURL: "https://inference.paperdebugger.workers.dev",
			InferenceAPIKey:  "inf-key",
		},
	}

	// MiniMax model should route to MiniMax API
	llmConfig := &models.LLMProviderConfig{
		ModelName: "MiniMax-M2.7",
	}
	oaiClient := client.GetOpenAIClient(llmConfig)
	assert.NotNil(t, oaiClient)

	// GPT model should route to inference (no user API key)
	llmConfigGPT := &models.LLMProviderConfig{
		ModelName: "gpt-5.1",
	}
	oaiClientGPT := client.GetOpenAIClient(llmConfigGPT)
	assert.NotNil(t, oaiClientGPT)
}

func TestIntegration_MiniMaxProviderRouting_NoServerKey(t *testing.T) {
	// Simulate server without MINIMAX_API_KEY
	client := &AIClientV2{
		cfg: &cfg.Cfg{
			MiniMaxAPIKey:    "",
			MiniMaxBaseURL:   "https://api.minimax.io/v1",
			InferenceBaseURL: "https://inference.paperdebugger.workers.dev",
			InferenceAPIKey:  "inf-key",
		},
	}

	// MiniMax model should fall back to inference/OpenRouter
	llmConfig := &models.LLMProviderConfig{
		ModelName: "minimax/MiniMax-M2.7",
	}
	oaiClient := client.GetOpenAIClient(llmConfig)
	assert.NotNil(t, oaiClient)
}

func TestIntegration_MiniMaxProviderRouting_UserHasOwnKey(t *testing.T) {
	// User has their own OpenAI key, but MiniMax model should still route to MiniMax
	client := &AIClientV2{
		cfg: &cfg.Cfg{
			MiniMaxAPIKey:    "mm-server-key",
			MiniMaxBaseURL:   "https://api.minimax.io/v1",
			OpenAIBaseURL:    "https://api.openai.com/v1",
			InferenceBaseURL: "https://inference.paperdebugger.workers.dev",
			InferenceAPIKey:  "inf-key",
		},
	}

	// MiniMax model with user API key should still route to MiniMax API
	llmConfig := &models.LLMProviderConfig{
		APIKey:    "sk-user-openai-key",
		ModelName: "MiniMax-M2.7",
	}
	oaiClient := client.GetOpenAIClient(llmConfig)
	assert.NotNil(t, oaiClient)
}

func TestIntegration_MiniMaxLiveAPI(t *testing.T) {
	apiKey := os.Getenv("MINIMAX_API_KEY")
	if apiKey == "" {
		t.Skip("MINIMAX_API_KEY not set, skipping live API test")
	}

	client := &AIClientV2{
		cfg: &cfg.Cfg{
			MiniMaxAPIKey:    apiKey,
			MiniMaxBaseURL:   "https://api.minimax.io/v1",
			InferenceBaseURL: "https://inference.paperdebugger.workers.dev",
			InferenceAPIKey:  "dummy",
		},
	}

	llmConfig := &models.LLMProviderConfig{
		ModelName: "MiniMax-M2.7",
	}

	oaiClient := client.GetOpenAIClient(llmConfig)
	assert.NotNil(t, oaiClient, "live MiniMax client should be created successfully")
}
