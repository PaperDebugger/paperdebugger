package services

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	OpenRouterModelsURL = "https://openrouter.ai/api/v1/models"
	PriceRefreshInterval = 24 * time.Hour
)

type PricingService struct {
	BaseService
	collection *mongo.Collection
	httpClient *http.Client
}

// OpenRouterModel represents a model from the OpenRouter API.
type OpenRouterModel struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Pricing struct {
		Prompt     string `json:"prompt"`
		Completion string `json:"completion"`
	} `json:"pricing"`
}

// OpenRouterResponse is the response from the OpenRouter models API.
type OpenRouterResponse struct {
	Data []OpenRouterModel `json:"data"`
}

func NewPricingService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger) *PricingService {
	base := NewBaseService(db, cfg, logger)
	return &PricingService{
		BaseService: base,
		collection:  base.db.Collection((models.ModelPricing{}).CollectionName()),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// FetchAndUpdatePrices fetches model prices from OpenRouter and updates the database.
func (s *PricingService) FetchAndUpdatePrices(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, OpenRouterModelsURL, nil)
	if err != nil {
		return err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var openRouterResp OpenRouterResponse
	if err := json.NewDecoder(resp.Body).Decode(&openRouterResp); err != nil {
		return err
	}

	now := time.Now()
	for _, model := range openRouterResp.Data {
		promptPrice, _ := strconv.ParseFloat(model.Pricing.Prompt, 64)
		completionPrice, _ := strconv.ParseFloat(model.Pricing.Completion, 64)

		// Skip models with no pricing
		if promptPrice == 0 && completionPrice == 0 {
			continue
		}

		// Extract model slug (short name) from the full model ID
		// e.g., "openai/gpt-4" -> "gpt-4"
		modelSlug := extractModelSlug(model.ID)

		filter := bson.M{"model_id": model.ID}
		update := bson.M{
			"$set": bson.M{
				"model_id":         model.ID,
				"model_slug":       modelSlug,
				"name":             model.Name,
				"prompt_price":     promptPrice,
				"completion_price": completionPrice,
				"updated_at":       now,
			},
			"$setOnInsert": bson.M{
				"_id": bson.NewObjectID(),
			},
		}
		opts := options.UpdateOne().SetUpsert(true)
		_, err := s.collection.UpdateOne(ctx, filter, update, opts)
		if err != nil {
			s.logger.Warn("Failed to update model pricing", "modelID", model.ID, "error", err)
		}
	}

	s.logger.Info("Updated model pricing", "count", len(openRouterResp.Data))
	return nil
}

// GetPricing returns the pricing for a model by its slug.
func (s *PricingService) GetPricing(ctx context.Context, modelSlug string) (*models.ModelPricing, error) {
	// Try exact match first
	filter := bson.M{"model_slug": modelSlug}
	var pricing models.ModelPricing
	err := s.collection.FindOne(ctx, filter).Decode(&pricing)
	if err == nil {
		return &pricing, nil
	}
	if err != mongo.ErrNoDocuments {
		return nil, err
	}

	// Try partial match (model slug might be a prefix)
	// Use QuoteMeta to escape any regex special characters in the model slug
	filter = bson.M{"model_slug": bson.M{"$regex": "^" + regexp.QuoteMeta(modelSlug)}}
	err = s.collection.FindOne(ctx, filter).Decode(&pricing)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &pricing, nil
}

// GetAllPricing returns all model pricing.
func (s *PricingService) GetAllPricing(ctx context.Context) ([]models.ModelPricing, error) {
	cursor, err := s.collection.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var pricings []models.ModelPricing
	if err := cursor.All(ctx, &pricings); err != nil {
		return nil, err
	}
	return pricings, nil
}

// GetPricingMap returns a map of model slug to pricing for quick lookup.
func (s *PricingService) GetPricingMap(ctx context.Context) (map[string]*models.ModelPricing, error) {
	pricings, err := s.GetAllPricing(ctx)
	if err != nil {
		return nil, err
	}

	result := make(map[string]*models.ModelPricing)
	for i := range pricings {
		result[pricings[i].ModelSlug] = &pricings[i]
	}
	return result, nil
}

// extractModelSlug extracts the short model name from a full model ID.
// e.g., "openai/gpt-4" -> "gpt-4", "anthropic/claude-3-opus" -> "claude-3-opus"
func extractModelSlug(modelID string) string {
	parts := strings.Split(modelID, "/")
	if len(parts) > 1 {
		return parts[len(parts)-1]
	}
	return modelID
}

// StartPriceUpdater starts a background goroutine that periodically updates prices.
func (s *PricingService) StartPriceUpdater(ctx context.Context) {
	// Fetch immediately on startup
	go func() {
		if err := s.FetchAndUpdatePrices(ctx); err != nil {
			s.logger.Error("Failed to fetch initial model pricing", "error", err)
		}
	}()

	// Then fetch periodically
	go func() {
		ticker := time.NewTicker(PriceRefreshInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := s.FetchAndUpdatePrices(context.Background()); err != nil {
					s.logger.Error("Failed to update model pricing", "error", err)
				}
			}
		}
	}()
}
