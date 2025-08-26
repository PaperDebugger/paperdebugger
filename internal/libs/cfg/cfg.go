package cfg

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Cfg struct {
	OpenAIAPIKey  string
	JwtSigningKey string

	MongoURI string
}

var cfg *Cfg

func GetCfg() *Cfg {
	_ = godotenv.Load()
	cfg = &Cfg{
		OpenAIAPIKey:  os.Getenv("OPENAI_API_KEY"),
		JwtSigningKey: os.Getenv("JWT_SIGNING_KEY"),
		MongoURI:      mongoURI(),
	}

	return cfg
}

func mongoURI() string {
	val := os.Getenv("PD_MONGO_URI")
	if val != "" {
		return val
	}

	port := os.Getenv("MONGO_SERVICE_PORT_MONGO")
	if port == "" {
		return ""
	}
	return fmt.Sprintf("mongodb://mongo:%s", port)
}
