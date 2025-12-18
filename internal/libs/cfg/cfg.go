package cfg

import (
	"os"

	"github.com/joho/godotenv"
)

type Cfg struct {
	OpenAIBaseURL    string
	OpenAIAPIKey     string
	InferenceBaseURL string
	InferenceAPIKey  string
	JwtSigningKey    string

	MongoURI   string
	XtraMCPURI string
}

var cfg *Cfg

func GetCfg() *Cfg {
	_ = godotenv.Load()
	cfg = &Cfg{
		OpenAIBaseURL:    openAIBaseURL(),
		OpenAIAPIKey:     os.Getenv("OPENAI_API_KEY"),
		InferenceBaseURL: inferenceBaseURL(),
		InferenceAPIKey:  os.Getenv("INFERENCE_API_KEY"),
		JwtSigningKey:    os.Getenv("JWT_SIGNING_KEY"),
		MongoURI:         mongoURI(),
		XtraMCPURI:       xtraMCPURI(),
	}

	return cfg
}

func openAIBaseURL() string {
	val := os.Getenv("OPENAI_BASE_URL")
	if val != "" {
		return val
	}
	return "https://api.openai.com/v1"
}

func inferenceBaseURL() string {
	val := os.Getenv("INFERENCE_BASE_URL")
	if val != "" {
		return val
	}
	return "https://inference.paperdebugger.workers.dev/openrouter"
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
