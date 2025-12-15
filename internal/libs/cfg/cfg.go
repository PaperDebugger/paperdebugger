package cfg

import (
	"os"

	"github.com/joho/godotenv"
)

type Cfg struct {
	PDInferenceBaseURL string
	PDInferenceAPIKey  string
	JwtSigningKey      string
	MongoURI           string
	XtraMCPURI         string
}

var cfg *Cfg

func GetCfg() *Cfg {
	_ = godotenv.Load()
	cfg = &Cfg{
		PDInferenceBaseURL: pdInferenceBaseURL(),
		PDInferenceAPIKey:  os.Getenv("PD_INFERENCE_API_KEY"),
		JwtSigningKey:      os.Getenv("JWT_SIGNING_KEY"),
		MongoURI:           mongoURI(),
		XtraMCPURI:         xtraMCPURI(),
	}

	return cfg
}

func pdInferenceBaseURL() string {
	val := os.Getenv("PD_INFERENCE_BASE_URL")
	if val != "" {
		return val
	}
	return "https://inference.paperdebugger.workers.dev/"
}

func xtraMCPURI() string {
	val := os.Getenv("XTRAMCP_URI")
	if val != "" {
		return val
	}
	return "http://paperdebugger-xtramcp-server:8080/mcp"
}

func mongoURI() string {
	val := os.Getenv("PD_MONGO_URI")
	if val != "" {
		return val
	}

	return "mongodb://localhost:27017"
}
