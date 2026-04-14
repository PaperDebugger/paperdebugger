package client

import (
	"context"
	"encoding/json"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/toolkit/handler"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"
	"strconv"
	"strings"
	"time"

	"github.com/openai/openai-go/v3"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// UsageCost holds cost information from a completion.
type UsageCost struct {
	Cost float64
}

// define []openai.ChatCompletionMessageParamUnion as OpenAIChatHistory

// ChatCompletion orchestrates a chat completion process with a language model (e.g., GPT), handling tool calls and message history management.
//
// Parameters:
//
//	ctx: The context for controlling cancellation and deadlines.
//	modelSlug: The language model to use for completion (e.g., GPT-3.5, GPT-4).
//	messages: The full chat history (as input) to send to the language model.
//
// Returns:
//  1. The full chat history sent to the language model (including any tool call results).
//  2. The incremental chat history visible to the user (including tool call results and assistant responses).
//  3. Cost information (in USD).
//  4. An error, if any occurred during the process.
func (a *AIClientV2) ChatCompletionV2(ctx context.Context, userID bson.ObjectID, projectID string, modelSlug string, messages OpenAIChatHistory, llmProvider *models.LLMProviderConfig) (OpenAIChatHistory, AppChatHistory, UsageCost, error) {
	openaiChatHistory, inappChatHistory, usage, err := a.ChatCompletionStreamV2(ctx, nil, userID, projectID, "", modelSlug, messages, llmProvider)
	if err != nil {
		return nil, nil, usage, err
	}
	return openaiChatHistory, inappChatHistory, usage, nil
}

// ChatCompletionStream orchestrates a streaming chat completion process with a language model (e.g., GPT), handling tool calls, message history management, and real-time streaming of responses to the client.
//
// Parameters:
//
//	ctx: The context for controlling cancellation and deadlines.
//	callbackStream: The gRPC stream to which incremental responses are sent in real time.
//	conversationId: The unique identifier for the conversation session in PaperDebugger.
//	languageModel: The language model to use for completion (e.g., GPT-3.5, GPT-4).
//	messages: The full chat history (as input) to send to the language model.
//
// Returns: (same as ChatCompletion)
//  1. The full chat history sent to the language model (including any tool call results).
//  2. The incremental chat history visible to the user (including tool call results and assistant responses).
//  3. Cost information (in USD, accumulated across all calls).
//  4. An error, if any occurred during the process. (However, in the streaming mode, the error is not returned, but sending by callbackStream)
//
// This function works as follows: (same as ChatCompletion)
//   - It initializes the chat history for the language model and the user, and sets up a stream handler for real-time updates.
//   - It repeatedly sends the current chat history to the language model, receives streaming responses, and forwards them to the client as they arrive.
//   - If tool calls are required, it handles them and appends the results to the chat history, then continues the loop.
//   - If no tool calls are needed, it appends the assistant's response and exits the loop.
//   - Finally, it returns the updated chat histories, accumulated cost, and any error encountered.
func (a *AIClientV2) ChatCompletionStreamV2(ctx context.Context, callbackStream chatv2.ChatService_CreateConversationMessageStreamServer, userID bson.ObjectID, projectID string, conversationId string, modelSlug string, messages OpenAIChatHistory, llmProvider *models.LLMProviderConfig) (OpenAIChatHistory, AppChatHistory, UsageCost, error) {
	openaiChatHistory := messages
	inappChatHistory := AppChatHistory{}
	usage := UsageCost{}
	success := false // Track whether the request completed successfully

	streamHandler := handler.NewStreamHandlerV2(callbackStream, conversationId, modelSlug)

	streamHandler.SendInitialization()
	defer func() {
		streamHandler.SendFinalization()
	}()

	// Track usage on all exit paths (success or error) to prevent abuse
	// Only track if userID is provided and user is not using their own API key (BYOK)
	defer func() {
		if !userID.IsZero() && !llmProvider.IsCustomModel && usage.Cost > 0 {
			// Use a detached context since the request context may be canceled
			trackCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := a.usageService.TrackUsage(trackCtx, userID, projectID, usage.Cost, success); err != nil {
				a.logger.Error("Error while tracking usage", "error", err)
			}
		}
	}()

	oaiClient := a.GetOpenAIClient(llmProvider)
	params := getDefaultParamsV2(modelSlug, a.toolCallHandler.Registry, customModel)

	for {
		params.Messages = openaiChatHistory
		// var openaiOutput OpenAIChatHistory
		stream := oaiClient.Chat.Completions.NewStreaming(context.Background(), params)

		reasoning_content := ""
		answer_content := ""
		answer_content_id := ""
		has_sent_part_begin := false
		has_finished := false
		tool_info := map[int]map[string]string{}
		toolCalls := []openai.FinishedChatCompletionToolCall{}
		handleReasoning := func(raw string) (string, bool) {
			raw = strings.TrimSpace(raw)
			if raw == "" || raw == "null" {
				return "", false
			}
			var s string
			if err := json.Unmarshal([]byte(raw), &s); err != nil || s == "" {
				return "", false
			}
			return s, true
		}

		for stream.Next() {
			chunk := stream.Current()

			// Capture cost from any chunk that has usage data (OpenRouter sends usage in a separate chunk after FinishReason)
			if chunk.Usage.PromptTokens > 0 || chunk.Usage.CompletionTokens > 0 {
				if costField, ok := chunk.Usage.JSON.ExtraFields["cost"]; ok {
					if cost, err := strconv.ParseFloat(costField.Raw(), 64); err == nil {
						usage.Cost += cost
					}
				}
			}

			if len(chunk.Choices) == 0 {
				continue
			}

			delta := chunk.Choices[0].Delta

			// Send StreamPartBegin before any content (reasoning or answer) to ensure
			// the frontend has created the assistant message part before receiving chunks.
			// This is critical for models that send reasoning_content before regular content.
			// We use HandleAssistantPartBegin instead of HandleAddedItem because the first
			// chunk with reasoning content may not have delta.Role set to "assistant".
			_, hasReasoningContent := delta.JSON.ExtraFields["reasoning_content"]
			_, hasReasoning := delta.JSON.ExtraFields["reasoning"]
			if !has_sent_part_begin && (delta.Role == "assistant" || delta.Content != "" || hasReasoningContent || hasReasoning) {
				has_sent_part_begin = true
				streamHandler.HandleAssistantPartBegin(chunk.ID)
			}

			reasoningHandled := false
			if field, ok := delta.JSON.ExtraFields["reasoning_content"]; ok {
				if s, ok := handleReasoning(field.Raw()); ok {
					reasoning_content += s
					streamHandler.HandleReasoningDelta(chunk.ID, s)
					reasoningHandled = true
				}
			}
			if !reasoningHandled {
				if field, ok := delta.JSON.ExtraFields["reasoning"]; ok {
					if s, ok := handleReasoning(field.Raw()); ok {
						reasoning_content += s
						streamHandler.HandleReasoningDelta(chunk.ID, s)
						reasoningHandled = true
					}
				}
			}

			if !reasoningHandled {
				if delta.Content != "" {
					answer_content += delta.Content
					answer_content_id = chunk.ID
					streamHandler.HandleTextDelta(chunk)
					// fmt.Print(delta.Content)
				}

				if len(delta.ToolCalls) > 0 {
					for _, toolCall := range delta.ToolCalls {
						index := int(toolCall.Index)

						// haskey(tool_info, index)
						if _, ok := tool_info[index]; !ok {
							// fmt.Printf("Prepare tool %s\n", toolCall.Function.Name)
							tool_info[index] = map[string]string{}
							streamHandler.HandleAddedItem(chunk)
						}

						if toolCall.ID != "" {
							tool_info[index]["id"] = tool_info[index]["id"] + toolCall.ID
						}

						if toolCall.Function.Name != "" {
							tool_info[index]["name"] = tool_info[index]["name"] + toolCall.Function.Name
						}

						if toolCall.Function.Arguments != "" {
							tool_info[index]["arguments"] = tool_info[index]["arguments"] + toolCall.Function.Arguments
							// check if arguments can be unmarshaled, if not, means the arguments are not ready
							var dummy map[string]any
							if err := json.Unmarshal([]byte(tool_info[index]["arguments"]), &dummy); err == nil {
								streamHandler.HandleToolArgPreparedDoneItem(index, tool_info[index]["id"], tool_info[index]["name"], tool_info[index]["arguments"])
								toolCalls = append(toolCalls, openai.FinishedChatCompletionToolCall{
									Index: index,
									ID:    tool_info[index]["id"],
									ChatCompletionMessageFunctionToolCallFunction: openai.ChatCompletionMessageFunctionToolCallFunction{
										Name:      tool_info[index]["name"],
										Arguments: tool_info[index]["arguments"],
									},
								})
							}
						}
					}
				}
			}

			if chunk.Choices[0].FinishReason != "" && !has_finished {
				streamHandler.HandleTextDoneItem(chunk, answer_content, reasoning_content)
				has_finished = true
				// Don't break - continue reading to capture the usage chunk that comes after
			}
		}

		if err := stream.Err(); err != nil {
			return nil, nil, usage, err
		}

		if answer_content != "" {
			appendAssistantTextResponseV2(&openaiChatHistory, &inappChatHistory, answer_content, answer_content_id, modelSlug)
		}

		// Execute the calls (if any), return incremental data
		openaiToolHistory, inappToolHistory, err := a.toolCallHandler.HandleToolCallsV2(ctx, toolCalls, streamHandler)
		if err != nil {
			return nil, nil, usage, err
		}

		// // Record the tool call results
		if len(openaiToolHistory) > 0 {
			openaiChatHistory = append(openaiChatHistory, openaiToolHistory...)
			inappChatHistory = append(inappChatHistory, inappToolHistory...)
		} else {
			// response stream is finished, if there is no tool call, then break
			break
		}
	}

	success = true
	return openaiChatHistory, inappChatHistory, usage, nil
}
