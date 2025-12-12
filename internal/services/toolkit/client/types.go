package client

import (
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/openai/openai-go/v3"
)

type OpenAIChatHistory []openai.ChatCompletionMessageParamUnion
type AppChatHistory []chatv1.Message
