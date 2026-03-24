package client

import (
	"paperdebugger/internal/services/toolkit/registry"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetDefaultParamsV2_MiniMaxTemperature(t *testing.T) {
	toolRegistry := registry.NewToolRegistryV2()

	tests := []struct {
		name      string
		modelSlug string
		expectSet bool // whether temperature should be set (Valid)
		maxTemp   float64
	}{
		{
			name:      "MiniMax M2.7 has temperature clamped to [0,1]",
			modelSlug: "MiniMax-M2.7",
			expectSet: true,
			maxTemp:   1.0,
		},
		{
			name:      "MiniMax M2.7 highspeed has temperature clamped",
			modelSlug: "MiniMax-M2.7-highspeed",
			expectSet: true,
			maxTemp:   1.0,
		},
		{
			name:      "MiniMax via OpenRouter has temperature clamped",
			modelSlug: "minimax/MiniMax-M2.7",
			expectSet: true,
			maxTemp:   1.0,
		},
		{
			name:      "GPT-4.1 uses standard temperature",
			modelSlug: "gpt-4.1",
			expectSet: true,
			maxTemp:   2.0,
		},
		{
			name:      "Qwen Plus uses standard temperature",
			modelSlug: "qwen/qwen-plus",
			expectSet: true,
			maxTemp:   2.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			params := getDefaultParamsV2(tt.modelSlug, toolRegistry)
			assert.Equal(t, tt.modelSlug, string(params.Model))

			if tt.expectSet {
				assert.True(t, params.Temperature.Valid(), "temperature should be set")
				temp := params.Temperature.Value
				assert.LessOrEqual(t, temp, tt.maxTemp, "temperature should be within range")
				assert.GreaterOrEqual(t, temp, 0.0, "temperature should be non-negative")
			}
		})
	}
}

func TestGetDefaultParamsV2_ReasoningModelsNoTemp(t *testing.T) {
	toolRegistry := registry.NewToolRegistryV2()

	reasoningModels := []string{
		"gpt-5-mini",
		"gpt-5-nano",
		"o4-mini",
		"o3-mini",
		"o3",
		"o1-mini",
	}

	for _, slug := range reasoningModels {
		t.Run(slug, func(t *testing.T) {
			params := getDefaultParamsV2(slug, toolRegistry)
			assert.Equal(t, slug, string(params.Model))
			// Reasoning models should not have temperature set
			assert.False(t, params.Temperature.Valid(), "reasoning model should not have temperature")
		})
	}
}

func TestGetDefaultParamsV2_MiniMaxHasTools(t *testing.T) {
	toolRegistry := registry.NewToolRegistryV2()

	params := getDefaultParamsV2("MiniMax-M2.7", toolRegistry)
	assert.NotNil(t, params.Tools, "MiniMax should have tools enabled")
	assert.True(t, params.ParallelToolCalls.Valid(), "parallel tool calls should be set")
	assert.True(t, params.ParallelToolCalls.Value, "MiniMax should support parallel tool calls")
	assert.True(t, params.Store.Valid(), "store should be set")
	assert.False(t, params.Store.Value, "store should be false")
}

func TestGetDefaultParamsV2_MiniMaxMaxCompletionTokens(t *testing.T) {
	toolRegistry := registry.NewToolRegistryV2()

	params := getDefaultParamsV2("MiniMax-M2.7", toolRegistry)
	assert.True(t, params.MaxCompletionTokens.Valid(), "max completion tokens should be set")
	assert.Equal(t, int64(4000), params.MaxCompletionTokens.Value, "max completion tokens should be 4000")
}
