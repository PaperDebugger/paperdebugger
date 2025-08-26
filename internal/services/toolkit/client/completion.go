package client

import (
	"context"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/toolkit/handler"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/openai/openai-go/v2/responses"
)

// ChatCompletion orchestrates a chat completion process with a language model (e.g., GPT), handling tool calls and message history management.
//
// Parameters:
//
//	ctx: The context for controlling cancellation and deadlines.
//	languageModel: The language model to use for completion (e.g., GPT-3.5, GPT-4).
//	messages: The full chat history (as input) to send to the language model.
//
// Returns:
//  1. The full chat history sent to the language model (including any tool call results).
//  2. The incremental chat history visible to the user (including tool call results and assistant responses).
//  3. An error, if any occurred during the process.
func (a *AIClient) ChatCompletion(ctx context.Context, languageModel models.LanguageModel, messages responses.ResponseInputParam) (responses.ResponseInputParam, []chatv1.Message, error) {
	openaiChatHistory, inappChatHistory, err := a.ChatCompletionStream(ctx, nil, "", languageModel, messages)
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
func (a *AIClient) ChatCompletionStream(ctx context.Context, callbackStream chatv1.ChatService_CreateConversationMessageStreamServer, conversationId string, languageModel models.LanguageModel, messages responses.ResponseInputParam) (responses.ResponseInputParam, []chatv1.Message, error) {
	openaiChatHistory := responses.ResponseNewParamsInputUnion{OfInputItemList: messages}
	inappChatHistory := []chatv1.Message{}

	streamHandler := handler.NewStreamHandler(callbackStream, conversationId, languageModel)

	streamHandler.SendInitialization()
	defer func() {
		streamHandler.SendFinalization()
	}()

	params := getDefaultParams(languageModel, openaiChatHistory, a.toolCallHandler.Registry)

	for {
		params.Input = openaiChatHistory
		var openaiOutput []responses.ResponseOutputItemUnion
		stream := a.openaiClient.Responses.NewStreaming(context.Background(), params)

		for stream.Next() {
			// time.Sleep(200 * time.Millisecond) // DEBUG POINT: change this to test in a slow mode
			chunk := stream.Current()
			switch chunk.Type {
			case "response.output_item.added":
				streamHandler.HandleAddedItem(chunk)
			case "response.output_item.done":
				streamHandler.HandleDoneItem(chunk) // send part end
			case "response.incomplete":
				// incomplete happens after "output_item.done" (if it happens)
				// It's an indicator that the response is incomplete.
				openaiOutput = chunk.Response.Output
				streamHandler.SendIncompleteIndicator(chunk.Response.IncompleteDetails.Reason, chunk.Response.ID)
			case "response.completed":
				openaiOutput = chunk.Response.Output
			case "response.output_text.delta":
				streamHandler.HandleTextDelta(chunk)
			}
		}

		if err := stream.Err(); err != nil {
			return nil, nil, err
		}

		// 把 openai 的 response 记录下来，然后执行调用（如果有）
		for _, item := range openaiOutput {
			if item.Type == "message" && item.Role == "assistant" {
				appendAssistantTextResponse(&openaiChatHistory, &inappChatHistory, item)
			}
		}

		// 执行调用（如果有），返回增量数据
		openaiToolHistory, inappToolHistory, err := a.toolCallHandler.HandleToolCalls(ctx, openaiOutput, streamHandler)
		if err != nil {
			return nil, nil, err
		}

		// 把工具调用结果记录下来
		if len(openaiToolHistory.OfInputItemList) > 0 {
			openaiChatHistory.OfInputItemList = append(openaiChatHistory.OfInputItemList, openaiToolHistory.OfInputItemList...)
			inappChatHistory = append(inappChatHistory, inappToolHistory...)
		} else {
			// response stream is finished, if there is no tool call, then break
			break
		}
	}

	ptrChatHistory := make([]*chatv1.Message, len(inappChatHistory))
	for i := range inappChatHistory {
		ptrChatHistory[i] = &inappChatHistory[i]
	}

	return openaiChatHistory.OfInputItemList, inappChatHistory, nil
}
