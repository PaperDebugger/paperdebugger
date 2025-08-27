package contextutil

import (
	"context"

	"paperdebugger/internal/accesscontrol"
	"paperdebugger/internal/libs/shared"

	"github.com/gin-gonic/gin"
)

type contextKey string

const (
	actorKey          = "actor"
	userIdKey         = "userId"
	projectIdKey      = "projectId"
	conversationIDKey = "conversationID"
)

func Get[T any](ctx context.Context, k string) (T, bool) {
	v, ok := ctx.Value(contextKey(k)).(T)
	return v, ok
}

func Set[T any](ctx context.Context, k string, v T) context.Context {
	if gc, ok := ctx.(*gin.Context); ok {
		gc.Set(k, v)
		return ctx
	}
	return context.WithValue(ctx, contextKey(k), v)
}

func SetActor(ctx context.Context, actor *accesscontrol.Actor) context.Context {
	return Set(ctx, actorKey, actor)
}

// GetActor returns the actor from the context. It usually represents the user who is interacting with the system.
func GetActor(ctx context.Context) (*accesscontrol.Actor, error) {
	v, ok := Get[*accesscontrol.Actor](ctx, actorKey)
	if !ok {
		return nil, shared.ErrInvalidActor()
	}
	return v, nil
}

func SetProjectID(ctx context.Context, projectId string) context.Context {
	return Set(ctx, projectIdKey, projectId)
}

func GetProjectID(ctx context.Context) (string, error) {
	v, ok := Get[string](ctx, projectIdKey)
	if !ok {
		return "", shared.ErrBadRequest("project id not found in context")
	}
	return v, nil
}

func SetConversationID(ctx context.Context, conversationID string) context.Context {
	return Set(ctx, conversationIDKey, conversationID)
}

func GetConversationID(ctx context.Context) (string, error) {
	v, ok := Get[string](ctx, conversationIDKey)
	if !ok {
		return "", shared.ErrBadRequest("conversation id not found in context")
	}
	return v, nil
}
