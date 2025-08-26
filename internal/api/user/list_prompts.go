package user

import (
	"context"
	"sort"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
	"paperdebugger/internal/api/mapper"
	"paperdebugger/internal/libs/contextutil"
	userv1 "paperdebugger/pkg/gen/api/user/v1"
)

var defaultPrompts = []*userv1.Prompt{
	{
		Id:           "1",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Improve Academic Writing Style",
		Content:      "Please help me improve the academic writing style of this text. Focus on making it more formal, precise, and scholarly while maintaining clarity.",
		IsUserPrompt: false,
	},
	{
		Id:           "2",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Strengthen Arguments",
		Content:      "Analyze the arguments in this text and suggest ways to strengthen them. Consider logical flow, evidence support, and potential counterarguments that should be addressed.",
		IsUserPrompt: false,
	},
	{
		Id:           "3",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Academic Citations",
		Content:      "Review my citations and references. Suggest relevant academic sources that could strengthen my argument and identify any areas where additional citations are needed.",
		IsUserPrompt: false,
	},
	{
		Id:           "4",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Literature Review Help",
		Content:      "Help me improve this literature review section. Suggest ways to better synthesize the research, identify key themes, and highlight gaps in the literature.",
		IsUserPrompt: false,
	},
	{
		Id:           "5",
		CreatedAt:    timestamppb.New(time.Time{}),
		UpdatedAt:    timestamppb.New(time.Time{}),
		Title:        "Research Methods",
		Content:      "Review my research methodology section. Suggest improvements for research design, data collection methods, and analysis approach to enhance academic rigor.",
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
