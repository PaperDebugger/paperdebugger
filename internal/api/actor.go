package api

import (
	"context"

	"paperdebugger/internal/accesscontrol"
	"paperdebugger/internal/libs/jwt"
	"paperdebugger/internal/libs/shared"
	"paperdebugger/internal/services"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func parseUserActor(ctx context.Context, token string, userService *services.UserService) (*accesscontrol.Actor, error) {
	if len(token) == 0 {
		return nil, shared.ErrInvalidToken("Authentication token is required")
	}

	claims, err := jwt.VerifyJwtToken(token)
	if err != nil {
		return nil, shared.ErrInvalidToken(err.Error())
	}

	if len(claims.Audience) == 0 || claims.Audience[0] != "paperdebugger/user" {
		return nil, shared.ErrInvalidActor("Invalid token audience")
	}

	actorID, err := bson.ObjectIDFromHex(claims.Subject)
	if err != nil {
		return nil, shared.ErrInvalidActor("Invalid actor ID format")
	}

	_, err = userService.GetUserByID(ctx, actorID)
	if err != nil {
		return nil, shared.ErrInvalidUser(err.Error())
	}

	return &accesscontrol.Actor{ID: actorID}, nil
}
