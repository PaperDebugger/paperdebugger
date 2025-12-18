package chat

import (
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"

	"github.com/openai/openai-go/v2"
)

type OpenAIChatHistory []openai.ChatCompletionMessageParamUnion
type AppChatHistory []chatv2.Message
