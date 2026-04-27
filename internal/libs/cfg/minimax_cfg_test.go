package cfg

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMiniMaxBaseURL_Default(t *testing.T) {
	os.Unsetenv("MINIMAX_BASE_URL")
	url := miniMaxBaseURL()
	assert.Equal(t, "https://api.minimax.io/v1", url)
}

func TestMiniMaxBaseURL_Custom(t *testing.T) {
	os.Setenv("MINIMAX_BASE_URL", "https://custom.minimax.io/v1")
	defer os.Unsetenv("MINIMAX_BASE_URL")

	url := miniMaxBaseURL()
	assert.Equal(t, "https://custom.minimax.io/v1", url)
}

func TestCfg_MiniMaxFields(t *testing.T) {
	os.Setenv("MINIMAX_API_KEY", "test-minimax-key")
	os.Setenv("MINIMAX_BASE_URL", "https://test.minimax.io/v1")
	defer func() {
		os.Unsetenv("MINIMAX_API_KEY")
		os.Unsetenv("MINIMAX_BASE_URL")
	}()

	c := GetCfg()
	assert.Equal(t, "test-minimax-key", c.MiniMaxAPIKey)
	assert.Equal(t, "https://test.minimax.io/v1", c.MiniMaxBaseURL)
}

func TestCfg_MiniMaxFieldsEmpty(t *testing.T) {
	os.Unsetenv("MINIMAX_API_KEY")
	os.Unsetenv("MINIMAX_BASE_URL")

	c := GetCfg()
	assert.Empty(t, c.MiniMaxAPIKey)
	assert.Equal(t, "https://api.minimax.io/v1", c.MiniMaxBaseURL)
}
