package cfg

import (
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func init() {
	os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017")
	os.Setenv("OPENAI_API_KEY", "dummy OPENAI_API_KEY for testing")
	os.Setenv("JWT_SIGNING_KEY", "dummy JWT_SIGNING_KEY for testing")
}

func TestCfg(t *testing.T) {
	cfg := GetCfg()
	assert.NotNil(t, cfg)

	fmt.Printf("cfg: %+v\n", cfg)

	assert.NotNil(t, cfg.MongoURI)
	assert.NotNil(t, cfg.JwtSigningKey)
	assert.NotNil(t, cfg.OpenAIAPIKey)

	assert.NotEmpty(t, cfg.JwtSigningKey)
	assert.NotEmpty(t, cfg.OpenAIAPIKey)
	assert.NotEmpty(t, cfg.MongoURI)
}
