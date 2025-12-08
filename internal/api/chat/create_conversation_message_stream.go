package chat

import (
	"errors"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"
)

func (s *ChatServer) sendStreamError(stream chatv1.ChatService_CreateConversationMessageStreamServer, err error) error {
	return stream.Send(&chatv1.CreateConversationMessageStreamResponse{
		ResponsePayload: &chatv1.CreateConversationMessageStreamResponse_StreamError{
			StreamError: &chatv1.StreamError{
				ErrorMessage: err.Error(),
			},
		},
	})
}

func (s *ChatServer) CreateConversationMessageStream(
	req *chatv1.CreateConversationMessageStreamRequest,
	stream chatv1.ChatService_CreateConversationMessageStreamServer,
) error {
	return s.sendStreamError(stream, errors.New("Due to some technical problem from LLM providers, we are trying to bring the service back. Please retry later."))
}
