package api

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/bson"
	"paperdebugger/internal/accesscontrol"
	"paperdebugger/internal/libs/jwt"
	"paperdebugger/internal/libs/shared"
	"paperdebugger/internal/services"
)

func parseUserActor(ctx context.Context, token string, userService *services.UserService) (*accesscontrol.Actor, error) {
	if len(token) == 0 {
		return nil, shared.ErrInvalidToken()
	}

	claims, err := jwt.VerifyJwtToken(token)
	if err != nil {
		return nil, shared.ErrInvalidToken(err)
	}

	if len(claims.Audience) == 0 || claims.Audience[0] != "paperdebugger/user" {
		return nil, shared.ErrInvalidActor()
	}

	actorID, err := bson.ObjectIDFromHex(claims.Subject)
	if err != nil {
		return nil, shared.ErrInvalidActor()
	}

	_, err = userService.GetUserByID(ctx, actorID)
	if err != nil {
		return nil, shared.ErrInvalidUser(err)
	}

	return &accesscontrol.Actor{ID: actorID}, nil
}
