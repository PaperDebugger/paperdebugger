package mapper

import (
	"paperdebugger/internal/models"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/samber/lo"
	"go.mongodb.org/mongo-driver/v2/bson"
	"google.golang.org/protobuf/encoding/protojson"
)

func BSONToChatMessage(msg bson.M) *chatv1.Message {
	jsonBytes, err := bson.MarshalExtJSON(msg, true, true)
	if err != nil {
		return nil
	}

	m := &chatv1.Message{}
	if err := protojson.Unmarshal(jsonBytes, m); err != nil {
		return nil
	}
	return m
}

func MapModelConversationToProto(conversation *models.Conversation) *chatv1.Conversation {
	// Convert BSON messages back to protobuf messages
	filteredMessages := lo.Map(conversation.InappChatHistory, func(msg bson.M, _ int) *chatv1.Message {
		return BSONToChatMessage(msg)
	})

	filteredMessages = lo.Filter(filteredMessages, func(msg *chatv1.Message, _ int) bool {
		return msg.GetPayload().GetMessageType() != &chatv1.MessagePayload_System{}
	})

	return &chatv1.Conversation{
		Id:            conversation.ID.Hex(),
		Title:         conversation.Title,
		LanguageModel: chatv1.LanguageModel(conversation.LanguageModel),
		Messages:      filteredMessages,
	}
}
