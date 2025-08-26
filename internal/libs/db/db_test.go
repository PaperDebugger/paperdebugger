package db

import (
	"os"
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/logger"
	"testing"

	"github.com/stretchr/testify/assert"
)

func init() {
	os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017")
	os.Setenv("OPENAI_API_KEY", "dummy OPENAI_API_KEY for testing")
	os.Setenv("JWT_SIGNING_KEY", "dummy JWT_SIGNING_KEY for testing")
}

func TestDB(t *testing.T) {
	db, err := NewDB(cfg.GetCfg(), logger.GetLogger())
	assert.NoError(t, err)
	assert.NotNil(t, db)
}

func TestNewDB_PingError(t *testing.T) {
	// Store original URI to restore later
	originalURI := os.Getenv("PD_MONGO_URI")
	defer os.Setenv("PD_MONGO_URI", originalURI)

	testLogger := logger.GetLogger()

	t.Run("ping_fails_with_invalid_host", func(t *testing.T) {
		// Try with a completely invalid host that will fail on ping
		os.Setenv("PD_MONGO_URI", "mongodb://nonexistent-host-12345:27017")

		testCfg := cfg.GetCfg()

		db, err := NewDB(testCfg, testLogger)

		// This should fail either on connect or ping
		assert.Error(t, err)
		assert.Nil(t, db)
	})

	t.Run("ping_fails_with_unreachable_port", func(t *testing.T) {
		// Use a port that's likely not running MongoDB
		os.Setenv("PD_MONGO_URI", "mongodb://localhost:12345")

		testCfg := cfg.GetCfg()

		db, err := NewDB(testCfg, testLogger)

		// This should fail on connection or ping
		assert.Error(t, err)
		assert.Nil(t, db)
	})

	t.Run("ping_fails_with_short_timeout", func(t *testing.T) {
		// Use a very short timeout that will likely cause ping to fail
		os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017/?serverSelectionTimeoutMS=1&connectTimeoutMS=1")

		testCfg := cfg.GetCfg()

		db, err := NewDB(testCfg, testLogger)

		// This should fail on connection or ping due to timeout
		assert.Error(t, err)
		assert.Nil(t, db)
	})
}
