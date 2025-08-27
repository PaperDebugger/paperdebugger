package comment

import (
	"context"
	"fmt"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/shared"
	"paperdebugger/internal/models"
	commentv1 "paperdebugger/pkg/gen/api/comment/v1"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func validateCommentsAcceptedRequest(req *commentv1.CommentsAcceptedRequest) error {
	if req.GetProjectId() == "" {
		return shared.ErrBadRequest("project_id is required")
	}
	if req.GetConversationId() == "" {
		return shared.ErrBadRequest("conversation_id is required")
	}
	if req.GetMessageId() == "" {
		return shared.ErrBadRequest("message_id is required")
	}
	if len(req.GetCommentIds()) == 0 {
		return shared.ErrBadRequest("comment_ids is required")
	}
	return nil
}

func (s *CommentServer) CommentsAccepted(
	ctx context.Context,
	req *commentv1.CommentsAcceptedRequest,
) (*commentv1.CommentsAcceptedResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	if err := validateCommentsAcceptedRequest(req); err != nil {
		return nil, err
	}

	conversationObjectId, err := bson.ObjectIDFromHex(req.GetConversationId())
	if err != nil {
		return nil, shared.ErrBadRequest("invalid conversation_id")
	}

	_, err = s.projectService.GetProject(ctx, actor.ID, req.GetProjectId())
	if err != nil {
		return nil, shared.ErrBadRequest("failed to get project")
	}

	conversation, err := s.conversationService.GetConversation(ctx, actor.ID, conversationObjectId)
	if err != nil {
		return nil, shared.ErrBadRequest("failed to get conversation")
	}

	messageID := req.GetMessageId()
	messageExists := false
	for _, message := range conversation.InappChatHistory {
		msgId, ok := message["messageId"].(string)
		if ok && msgId == messageID {
			messageExists = true
			break
		}
	}
	if !messageExists {
		return nil, shared.ErrBadRequest("message_id not found in conversation")
	}

	for _, commentID := range req.GetCommentIds() {
		commentObjectId, err := bson.ObjectIDFromHex(commentID)
		if err != nil {
			return nil, shared.ErrBadRequest(fmt.Sprintf("invalid comment_id %s", commentID))
		}

		comment, err := s.reverseCommentService.GetComment(ctx, actor.ID, req.GetProjectId(), commentObjectId)
		if err != nil {
			return nil, shared.ErrBadRequest(fmt.Sprintf("failed to get comment %s", commentID))
		}

		comment.IsAddedToOverleaf = models.CommentStatusAccepted
		if err := s.reverseCommentService.UpdateComment(ctx, actor.ID, req.GetProjectId(), commentObjectId, comment); err != nil {
			return nil, shared.ErrBadRequest(fmt.Sprintf("failed to update comment %s", commentID))
		}
	}
	return &commentv1.CommentsAcceptedResponse{}, nil
}
