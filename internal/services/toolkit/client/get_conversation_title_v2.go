package client

// TODO: This file should not place in the client package.
import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"strings"

	chatv2 "paperdebugger/pkg/gen/api/chat/v2"

	"github.com/openai/openai-go/v3"
	"github.com/samber/lo"
	"go.mongodb.org/mongo-driver/v2/bson"
)

func (a *AIClientV2) GetConversationTitleV2(ctx context.Context, userID bson.ObjectID, inappChatHistory []*chatv2.Message, llmProvider *models.LLMProviderConfig) (string, error) {
	messages := lo.Map(inappChatHistory, func(message *chatv2.Message, _ int) string {
		if _, ok := message.Payload.MessageType.(*chatv2.MessagePayload_Assistant); ok {
			return fmt.Sprintf("Assistant: %s", message.Payload.GetAssistant().GetContent())
		}
		if _, ok := message.Payload.MessageType.(*chatv2.MessagePayload_User); ok {
			return fmt.Sprintf("User: %s", message.Payload.GetUser().GetContent())
		}
		if _, ok := message.Payload.MessageType.(*chatv2.MessagePayload_ToolCall); ok {
			return fmt.Sprintf("Tool '%s' called", message.Payload.GetToolCall().GetName())
		}
		return ""
	})
	message := strings.Join(messages, "\n")
	message = fmt.Sprintf("%s\nBased on above conversation, generate a short, clear, and descriptive title that summarizes the main topic or purpose of the discussion. The title should be concise, specific, and use natural language. Avoid vague or generic titles. Use abbreviation and short words if possible. Use 3-5 words if possible. Give me the title only, no other text including any other words.", message)

	_, resp, err := a.ChatCompletionV2(ctx, userID, "gpt-5-nano", OpenAIChatHistory{
		openai.SystemMessage("You are a helpful assistant that generates a title for a conversation."),
		openai.UserMessage(message),
	}, llmProvider)
	if err != nil {
		return "", err
	}

	if len(resp) == 0 {
		return "Untitled", nil
	}

	title := strings.TrimSpace(resp[0].Payload.GetAssistant().GetContent())
	title = strings.TrimLeft(title, "\"")
	title = strings.TrimRight(title, "\"")
	title = strings.TrimSpace(title)
	if title == "" {
		return "Untitled", nil
	}

	return title, nil
}
