package chat

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAllModels_ContainsMiniMax(t *testing.T) {
	var miniMaxModels []modelConfig
	for _, m := range allModels {
		if isMiniMaxModelConfig(m) {
			miniMaxModels = append(miniMaxModels, m)
		}
	}

	require.Len(t, miniMaxModels, 2, "expected 2 MiniMax models in the registry")

	// Verify MiniMax M2.7
	assert.Equal(t, "MiniMax M2.7", miniMaxModels[0].name)
	assert.Equal(t, "minimax/MiniMax-M2.7", miniMaxModels[0].slugOpenRouter)
	assert.Equal(t, "MiniMax-M2.7", miniMaxModels[0].slugOpenAI)
	assert.Equal(t, int64(1000000), miniMaxModels[0].totalContext)
	assert.Equal(t, int64(128000), miniMaxModels[0].maxOutput)
	assert.False(t, miniMaxModels[0].requireOwnKey)

	// Verify MiniMax M2.7 Highspeed
	assert.Equal(t, "MiniMax M2.7 Highspeed", miniMaxModels[1].name)
	assert.Equal(t, "minimax/MiniMax-M2.7-highspeed", miniMaxModels[1].slugOpenRouter)
	assert.Equal(t, "MiniMax-M2.7-highspeed", miniMaxModels[1].slugOpenAI)
	assert.Equal(t, int64(1000000), miniMaxModels[1].totalContext)
	assert.Equal(t, int64(128000), miniMaxModels[1].maxOutput)
	assert.False(t, miniMaxModels[1].requireOwnKey)
}

func TestIsMiniMaxModelConfig(t *testing.T) {
	tests := []struct {
		name     string
		config   modelConfig
		expected bool
	}{
		{
			name:     "MiniMax model",
			config:   modelConfig{slugOpenRouter: "minimax/MiniMax-M2.7"},
			expected: true,
		},
		{
			name:     "MiniMax highspeed model",
			config:   modelConfig{slugOpenRouter: "minimax/MiniMax-M2.7-highspeed"},
			expected: true,
		},
		{
			name:     "OpenAI model",
			config:   modelConfig{slugOpenRouter: "openai/gpt-5.1"},
			expected: false,
		},
		{
			name:     "Qwen model",
			config:   modelConfig{slugOpenRouter: "qwen/qwen-plus"},
			expected: false,
		},
		{
			name:     "Gemini model",
			config:   modelConfig{slugOpenRouter: "google/gemini-2.5-flash"},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, isMiniMaxModelConfig(tt.config))
		})
	}
}

func TestAllModels_UniqueSlugOpenRouter(t *testing.T) {
	slugs := make(map[string]bool)
	for _, m := range allModels {
		if slugs[m.slugOpenRouter] {
			t.Errorf("duplicate OpenRouter slug: %s", m.slugOpenRouter)
		}
		slugs[m.slugOpenRouter] = true
	}
}

func TestAllModels_UniqueSlugOpenAI(t *testing.T) {
	slugs := make(map[string]bool)
	for _, m := range allModels {
		if m.slugOpenAI == "" {
			continue
		}
		if slugs[m.slugOpenAI] {
			t.Errorf("duplicate OpenAI slug: %s", m.slugOpenAI)
		}
		slugs[m.slugOpenAI] = true
	}
}

func TestAllModels_ValidPricing(t *testing.T) {
	for _, m := range allModels {
		t.Run(m.name, func(t *testing.T) {
			assert.GreaterOrEqual(t, m.inputPrice, int64(0), "input price should be non-negative")
			assert.GreaterOrEqual(t, m.outputPrice, int64(0), "output price should be non-negative")
			assert.Greater(t, m.totalContext, int64(0), "total context should be positive")
			assert.Greater(t, m.maxOutput, int64(0), "max output should be positive")
		})
	}
}

func TestAllModels_MiniMaxPricingReasonable(t *testing.T) {
	for _, m := range allModels {
		if !isMiniMaxModelConfig(m) {
			continue
		}
		t.Run(m.name, func(t *testing.T) {
			assert.Greater(t, m.inputPrice, int64(0), "MiniMax input price should be positive")
			assert.Greater(t, m.outputPrice, int64(0), "MiniMax output price should be positive")
			// Highspeed variant should have lower or equal pricing
			if m.slugOpenAI == "MiniMax-M2.7-highspeed" {
				for _, other := range allModels {
					if other.slugOpenAI == "MiniMax-M2.7" {
						assert.LessOrEqual(t, m.inputPrice, other.inputPrice, "highspeed input should be <= standard")
						assert.LessOrEqual(t, m.outputPrice, other.outputPrice, "highspeed output should be <= standard")
					}
				}
			}
		})
	}
}
