package user

import (
	"context"
	"sort"
	"time"

	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	userv1 "paperdebugger/pkg/gen/api/user/v1"

	"google.golang.org/protobuf/types/known/timestamppb"
)

var defaultPrompts = []*userv1.Prompt{
	{
		Id:           "1",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Enhance Academic Writing (Powered by XtraGPT)",
		Content:      "Suggest context-aware academic paper writing enhancements for selected text.",
		IsUserPrompt: false,
	},
	{
		Id:           "2",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Review (Powered by XtraMCP)",
		Content:      "Review my paper and identify issues",
		IsUserPrompt: false,
	},
	{
		Id:           "3",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Find Relevant Papers (Powered by XtraMCP)",
		Content:      "Find me relevant papers to read",
		IsUserPrompt: false,
	},
	{
		Id:           "4",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Deep Research (Powered by XtraMCP)",
		Content:      "Do deep research and compare my papers against others",
		IsUserPrompt: false,
	},
}

func (s *UserServer) ListPrompts(
	ctx context.Context,
	req *userv1.ListPromptsRequest,
) (*userv1.ListPromptsResponse, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		return nil, err
	}

	prompts, err := s.promptService.ListPrompts(ctx, actor.ID)
	if err != nil {
		return nil, err
	}

	// Get user prompts
	userPrompts := mapper.MapModelPromptsToProto(prompts)

	// Sort user prompts by UpdatedAt in descending order
	sort.Slice(userPrompts, func(i, j int) bool {
		return userPrompts[i].UpdatedAt.AsTime().After(userPrompts[j].UpdatedAt.AsTime())
	})

	// Append default prompts after sorted user prompts
	allPrompts := append(userPrompts, defaultPrompts...)

	return &userv1.ListPromptsResponse{
		Prompts: allPrompts,
	}, nil
}
