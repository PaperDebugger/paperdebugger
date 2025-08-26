package client

// TODO: This file should not place in the client package.
import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"strings"

	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/openai/openai-go/v2/responses"
	"github.com/samber/lo"
)

func (a *AIClient) GetConversationTitle(ctx context.Context, inappChatHistory []*chatv1.Message) (string, error) {
	messages := lo.Map(inappChatHistory, func(message *chatv1.Message, _ int) string {
		if _, ok := message.Payload.MessageType.(*chatv1.MessagePayload_Assistant); ok {
			return fmt.Sprintf("Assistant: %s", message.Payload.GetAssistant().GetContent())
		}
		if _, ok := message.Payload.MessageType.(*chatv1.MessagePayload_User); ok {
			return fmt.Sprintf("User: %s", message.Payload.GetUser().GetContent())
		}
		if _, ok := message.Payload.MessageType.(*chatv1.MessagePayload_ToolCall); ok {
			return fmt.Sprintf("Tool '%s' called", message.Payload.GetToolCall().GetName())
		}
		return ""
	})
	message := strings.Join(messages, "\n")
	message = fmt.Sprintf("%s\nBased on above conversation, generate a short, clear, and descriptive title that summarizes the main topic or purpose of the discussion. The title should be concise, specific, and use natural language. Avoid vague or generic titles. Use abbreviation and short words if possible. Use 3-5 words if possible. Give me the title only, no other text including any other words.", message)

	_, resp, err := a.ChatCompletion(ctx, models.LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI), responses.ResponseInputParam{
		{
			OfInputMessage: &responses.ResponseInputItemMessageParam{
				Role: "system",
				Content: responses.ResponseInputMessageContentListParam{
					responses.ResponseInputContentParamOfInputText(`You are a helpful assistant that generates a title for a conversation.`),
				},
			},
		},
		{
			OfInputMessage: &responses.ResponseInputItemMessageParam{
				Role: "user",
				Content: responses.ResponseInputMessageContentListParam{
					responses.ResponseInputContentParamOfInputText(message),
				},
			},
		},
	})
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
