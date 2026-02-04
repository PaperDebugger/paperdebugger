package client

// TODO: This file should not place in the client package.
import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"strings"

	"github.com/openai/openai-go/v3"
	"go.mongodb.org/mongo-driver/v2/bson"
)

func (a *AIClientV2) GetCitationKeys(ctx context.Context, sentence string, userId bson.ObjectID, projectId string, llmProvider *models.LLMProviderConfig) (string, error) {
	// Get bibliography from mongodb
	project, err := a.projectService.GetProject(ctx, userId, projectId)
	if err != nil {
		return "", err
	}

	var bibFiles []string
	for _, doc := range project.Docs {
		if doc.Filepath != "" && strings.HasSuffix(doc.Filepath, ".bib") {
			bibFiles = append(bibFiles, doc.Lines...)
		}
	}
	bibliography := strings.Join(bibFiles, "\n")

	// Get citation keys from LLM
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
