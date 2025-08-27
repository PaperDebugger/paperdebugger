package cfg

import (
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

	return "mongodb://localhost:27017"
}
