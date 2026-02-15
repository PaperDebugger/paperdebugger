package mapper

import (
	"paperdebugger/internal/models"
	userv1 "paperdebugger/pkg/gen/api/user/v1"
)

func MapProtoSettingsToModel(settings *userv1.Settings) *models.Settings {
	// Map the slice of custom models
	customModels := make([]models.CustomModel, len(settings.CustomModels))
	for i, m := range settings.CustomModels {
		customModels[i] = models.CustomModel{
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
		EnableCompletion:             settings.EnableCompletion,
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
			Slug:          m.Slug,
			Name:          m.Name,
			BaseUrl:       m.BaseUrl,
			ApiKey:        m.APIKey,
			ContextWindow: m.ContextWindow,
			InputPrice:    m.InputPrice,
			OutputPrice:   m.OutputPrice,
		}
	}

	return &userv1.Settings{
		ShowShortcutsAfterSelection:  settings.ShowShortcutsAfterSelection,
		FullWidthPaperDebuggerButton: settings.FullWidthPaperDebuggerButton,
		EnableCompletion:             settings.EnableCompletion,
		FullDocumentRag:              settings.FullDocumentRag,
		ShowedOnboarding:             settings.ShowedOnboarding,
		OpenaiApiKey:                 settings.OpenAIAPIKey,
		CustomModels:                 customModels,
	}
}
