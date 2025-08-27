package main

import (
	"paperdebugger/internal"
	"paperdebugger/internal/api"
	"paperdebugger/internal/libs/logger"
)

func main() {
	app := initializeAppOnly()
	app.Run(":6060")
}

// initializeAppOnly initializes the app without starting the server (for testing)
func initializeAppOnly() *api.Server {
	log := logger.GetLogger()
	app, err := internal.InitializeApp()
	if err != nil {
		log.Fatalf("[PAPERDEBUGGER] failed to initialize app: %v", err)
	}
	return app
}
