package main

import (
	"os"
	"testing"
)

func TestMain_Success(t *testing.T) {
	// Set test environment variables
	os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017")
	_ = initializeAppOnly()
}
