package client

import (
	"context"
	"encoding/json"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/toolkit/handler"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"
	"time"

	"github.com/openai/openai-go/v3"
)

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
//  3. An error, if any occurred during the process.
func (a *AIClientV2) ChatCompletionV2(ctx context.Context, modelSlug string, messages OpenAIChatHistory, llmProvider *models.LLMProviderConfig) (OpenAIChatHistory, AppChatHistory, error) {
	openaiChatHistory, inappChatHistory, err := a.ChatCompletionStreamV2(ctx, nil, "", modelSlug, messages, llmProvider)
	if err != nil {
		return nil, nil, err
	}
	return openaiChatHistory, inappChatHistory, nil
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
//  3. An error, if any occurred during the process. (However, in the streaming mode, the error is not returned, but sending by callbackStream)
//
// This function works as follows: (same as ChatCompletion)
//   - It initializes the chat history for the language model and the user, and sets up a stream handler for real-time updates.
//   - It repeatedly sends the current chat history to the language model, receives streaming responses, and forwards them to the client as they arrive.
//   - If tool calls are required, it handles them and appends the results to the chat history, then continues the loop.
//   - If no tool calls are needed, it appends the assistant's response and exits the loop.
//   - Finally, it returns the updated chat histories and any error encountered.
func (a *AIClientV2) ChatCompletionStreamV2(ctx context.Context, callbackStream chatv2.ChatService_CreateConversationMessageStreamServer, conversationId string, modelSlug string, messages OpenAIChatHistory, llmProvider *models.LLMProviderConfig) (OpenAIChatHistory, AppChatHistory, error) {
	openaiChatHistory := messages
	inappChatHistory := AppChatHistory{}

	streamHandler := handler.NewStreamHandlerV2(callbackStream, conversationId, modelSlug)

	streamHandler.SendInitialization()
	defer func() {
		streamHandler.SendFinalization()
	}()

	oaiClient := a.GetOpenAIClient(llmProvider)
	params := getDefaultParamsV2(modelSlug, a.toolCallHandler.Registry)

	for {
		params.Messages = openaiChatHistory
		// var openaiOutput OpenAIChatHistory
		streamStartTime := time.Now()
		_ = streamStartTime
		stream := oaiClient.Chat.Completions.NewStreaming(context.Background(), params)

		reasoning_content := ""
		answer_content := ""
		answer_content_id := ""
		has_sent_part_begin := false
		firstChunkReceived := false
		tool_info := map[int]map[string]string{}
		toolCalls := []openai.FinishedChatCompletionToolCall{}
		for stream.Next() {
			// time.Sleep(5000 * time.Millisecond) // DEBUG POINT: change this to test in a slow mode
			chunk := stream.Current()

			if !firstChunkReceived {
				firstChunkReceived = true
			}

			if len(chunk.Choices) == 0 {
				// Handle usage information
				// fmt.Printf("Usage: %+v\n", chunk.Usage)
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

			if field, ok := delta.JSON.ExtraFields["reasoning_content"]; ok && field.Raw() != "null" {
				var s string
				err := json.Unmarshal([]byte(field.Raw()), &s)
				if err == nil {
					reasoning_content += s
					streamHandler.HandleReasoningDelta(chunk.ID, s)
				}
			} else if field, ok := delta.JSON.ExtraFields["reasoning"]; ok && field.Raw() != "null" {
				var s string
				err := json.Unmarshal([]byte(field.Raw()), &s)
				if err == nil {
					reasoning_content += s
					streamHandler.HandleReasoningDelta(chunk.ID, s)
				}
			} else {
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

			if chunk.Choices[0].FinishReason != "" {
				// fmt.Printf("FinishReason: %s\n", chunk.Choices[0].FinishReason)
				// answer_content += chunk.Choices[0].Delta.Content
				// fmt.Printf("answer_content: %s\n", answer_content)
				streamHandler.HandleTextDoneItem(chunk, answer_content, reasoning_content)
				break
			}
		}

		if err := stream.Err(); err != nil {
			return nil, nil, err
		}

		if answer_content != "" {
			appendAssistantTextResponseV2(&openaiChatHistory, &inappChatHistory, answer_content, answer_content_id, modelSlug)
		}

		// Execute the calls (if any), return incremental data
		openaiToolHistory, inappToolHistory, err := a.toolCallHandler.HandleToolCallsV2(ctx, toolCalls, streamHandler)
		if err != nil {
			return nil, nil, err
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

	return openaiChatHistory, inappChatHistory, nil
}
