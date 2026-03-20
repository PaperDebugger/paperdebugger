package mapper

import (
	"paperdebugger/internal/models"
	userv1 "paperdebugger/pkg/gen/api/user/v1"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func MapProtoSettingsToModel(settings *userv1.Settings) *models.Settings {
	// Map the slice of custom models
	customModels := make([]models.CustomModel, len(settings.CustomModels))
	for i, m := range settings.CustomModels {
		var id bson.ObjectID

		if m.Id == "" {
			id = bson.NewObjectID()
		} else {
			id, _ = bson.ObjectIDFromHex(m.Id)
		}

		customModels[i] = models.CustomModel{
			Id:            id,
			Slug:          m.Slug,
			Name:          m.Name,
			BaseUrl:       m.BaseUrl,
			APIKey:        m.ApiKey,
			ContextWindow: m.ContextWindow,
			MaxOutput:     m.MaxOutput,
			InputPrice:    m.InputPrice,
			OutputPrice:   m.OutputPrice,
		}
	}

	return &models.Settings{
		ShowShortcutsAfterSelection:  settings.ShowShortcutsAfterSelection,
		FullWidthPaperDebuggerButton: settings.FullWidthPaperDebuggerButton,
		EnableCitationSuggestion:     settings.EnableCitationSuggestion,
		FullDocumentRag:              settings.FullDocumentRag,
		ShowedOnboarding:             settings.ShowedOnboarding,
		OpenAIAPIKey:                 settings.OpenaiApiKey,
		CustomModels:                 customModels,
	}
}

func MapModelSettingsToProto(settings *models.Settings) *userv1.Settings {
	// Map the slice back to Proto
	customModels := make([]*userv1.CustomModel, len(settings.CustomModels))
	for i, m := range settings.CustomModels {
		customModels[i] = &userv1.CustomModel{
			Id:            m.Id.Hex(),
			Slug:          m.Slug,
			Name:          m.Name,
			BaseUrl:       m.BaseUrl,
			ApiKey:        m.APIKey,
			ContextWindow: m.ContextWindow,
			MaxOutput:     m.MaxOutput,
			InputPrice:    m.InputPrice,
			OutputPrice:   m.OutputPrice,
		}
	}

	return &userv1.Settings{
		ShowShortcutsAfterSelection:  settings.ShowShortcutsAfterSelection,
		FullWidthPaperDebuggerButton: settings.FullWidthPaperDebuggerButton,
		EnableCitationSuggestion:     settings.EnableCitationSuggestion,
		FullDocumentRag:              settings.FullDocumentRag,
		ShowedOnboarding:             settings.ShowedOnboarding,
		OpenaiApiKey:                 settings.OpenAIAPIKey,
		CustomModels:                 customModels,
	}
}
