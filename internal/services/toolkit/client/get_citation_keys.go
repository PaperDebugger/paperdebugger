package client

// TODO: This file should not place in the client package.
import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"strings"

	"github.com/openai/openai-go/v3"
)

func (a *AIClientV2) GetCitationKeys(ctx context.Context, sentence string, bibliography string, llmProvider *models.LLMProviderConfig) (string, error) {
	emptyCitation := "none"
	message := fmt.Sprintf("Sentence: %s\nBibliography: %s\nBased on the sentence and bibliography, suggest relevant citation keys separated by commas. If no relevant citations are found, return '%s'.", sentence, bibliography, emptyCitation)

	_, resp, err := a.ChatCompletionV2(ctx, "gpt-5-nano", OpenAIChatHistory{
		openai.SystemMessage("You are a helpful assistant that suggests relevant citation keys."),
		openai.UserMessage(message),
	}, llmProvider)

	if err != nil {
		return "", err
	}

	if len(resp) == 0 {
		return "", nil
	}

	citationKeys := strings.TrimSpace(resp[0].Payload.GetAssistant().GetContent())

	if citationKeys == emptyCitation {
		return "", nil
	}

	return citationKeys, nil
}
