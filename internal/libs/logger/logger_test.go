package logger

import (
	"testing"
)

func TestGetLogger(t *testing.T) {
	logger := GetLogger()
	logger.Info("Hello, world, info")
	logger.Error("Hello, world, error")
	logger.Warn("Hello, world, warn")
}
