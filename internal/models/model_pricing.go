package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// ModelPricing stores the pricing information for an LLM model.
// Prices are in USD per token.
type ModelPricing struct {
	ID              bson.ObjectID `bson:"_id"`
	ModelID         string        `bson:"model_id"`         // e.g., "openai/gpt-4"
	ModelSlug       string        `bson:"model_slug"`       // e.g., "gpt-4" (short name used in our app)
	Name            string        `bson:"name"`             // e.g., "OpenAI: GPT-4"
	PromptPrice     float64       `bson:"prompt_price"`     // USD per token
	CompletionPrice float64       `bson:"completion_price"` // USD per token
	UpdatedAt       time.Time     `bson:"updated_at"`
}

func (m ModelPricing) CollectionName() string {
	return "model_pricing"
}
