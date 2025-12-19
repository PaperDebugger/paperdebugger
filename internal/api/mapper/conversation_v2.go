package mapper

import (
	"paperdebugger/internal/models"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"

	"github.com/samber/lo"
	"go.mongodb.org/mongo-driver/v2/bson"
	"google.golang.org/protobuf/encoding/protojson"
)

func BSONToChatMessageV2(msg bson.M) *chatv2.Message {
	jsonBytes, err := bson.MarshalExtJSON(msg, true, true)
	if err != nil {
		return nil
	}

	m := &chatv2.Message{}
	if err := protojson.Unmarshal(jsonBytes, m); err != nil {
		return nil
	}
	return m
}

func MapModelConversationToProtoV2(conversation *models.Conversation) *chatv2.Conversation {
	// Convert BSON messages back to protobuf messages
	filteredMessages := lo.Map(conversation.InappChatHistory, func(msg bson.M, _ int) *chatv2.Message {
		return BSONToChatMessageV2(msg)
	})

	filteredMessages = lo.Filter(filteredMessages, func(msg *chatv2.Message, _ int) bool {
		return msg.GetPayload().GetMessageType() != &chatv2.MessagePayload_System{}
	})

	modelSlug := conversation.ModelSlug
	if modelSlug == "" {
		modelSlug = models.SlugFromLanguageModel(models.LanguageModel(conversation.LanguageModel))
	}

	return &chatv2.Conversation{
		Id:        conversation.ID.Hex(),
		Title:     conversation.Title,
		ModelSlug: modelSlug,
		Messages:  filteredMessages,
	}
}
