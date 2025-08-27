package logger

import (
	"os"

	"github.com/charmbracelet/log"
)

type Logger struct {
	*log.Logger
}

var logger *Logger

func GetLogger() *Logger {
	if logger == nil {
		logger = &Logger{log.New(os.Stdout)}
		logger.SetLevel(log.InfoLevel)
	}
	return logger
}
