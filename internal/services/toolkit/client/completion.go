package client

import (
	"context"
	"fmt"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services/toolkit/handler"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"
	"time"

	"github.com/openai/openai-go/v3"
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
func (a *AIClient) ChatCompletion(ctx context.Context, languageModel models.LanguageModel, messages OpenAIChatHistory, llmProvider *models.LLMProviderConfig) (OpenAIChatHistory, AppChatHistory, error) {
	openaiChatHistory, inappChatHistory, err := a.ChatCompletionStream(ctx, nil, "", languageModel, messages, llmProvider)
	if err != nil {
		return OpenAIChatHistory{}, AppChatHistory{}, err
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

func (a *AIClient) ChatCompletionStream(ctx context.Context, callbackStream chatv1.ChatService_CreateConversationMessageStreamServer, conversationId string, languageModel models.LanguageModel, messages OpenAIChatHistory, llmProvider *models.LLMProviderConfig) (OpenAIChatHistory, AppChatHistory, error) {
	openaiChatHistory := messages
	inappChatHistory := AppChatHistory{}

	streamHandler := handler.NewStreamHandler(callbackStream, conversationId, languageModel)

	streamHandler.SendInitialization()
	defer func() {
		streamHandler.SendFinalization()
	}()

	oaiClient := a.GetOpenAIClient(llmProvider)
	params := getDefaultParams(languageModel, a.toolCallHandler.Registry)

	for {
		params.Messages = openaiChatHistory
		// var openaiOutput OpenAIChatHistory
		stream := oaiClient.Chat.Completions.NewStreaming(context.Background(), params)
		acc := openai.ChatCompletionAccumulator{}

		toolCalls := []openai.FinishedChatCompletionToolCall{}
		for stream.Next() {
			time.Sleep(5000 * time.Millisecond) // DEBUG POINT: change this to test in a slow mode
			chunk := stream.Current()
			acc.AddChunk(chunk)
			// if using tool calls

			fmt.Printf("chunk choices: %d\n", len(chunk.Choices))
			fmt.Printf("chunk role: %s\n", chunk.Choices[0].Delta.Role)
			fmt.Printf("chunk content: %s\n", chunk.Choices[0].Delta.Content)
			fmt.Printf("chunk tool calls: %d\n", len(chunk.Choices[0].Delta.ToolCalls))
			fmt.Printf("chunk finish reason: %s\n", chunk.Choices[0].FinishReason)
			for _, tool := range chunk.Choices[0].Delta.ToolCalls {
				fmt.Printf("tool call: idx: %d name: %s args: %s id: %s\n", tool.Index, tool.Function.Name, tool.Function.Arguments, tool.ID)
			}
			fmt.Printf("chunk raw: %s\n", chunk.Choices[0].RawJSON())
			fmt.Println("")

			// role := chunk.Choices[0].Delta.Role
			content := chunk.Choices[0].Delta.Content
			// toolCalls := chunk.Choices[0].Delta.ToolCalls
			stopReason := chunk.Choices[0].FinishReason

			// if role != "" && content != "" {
			// 	fmt.Errorf("role should be empty: %s", chunk.RawJSON())
			// }

			// // if len(chunk.Choices) == 0 {
			// // 	fmt.Errorf("Error, choices is 0: %s", chunk.RawJSON())
			// // 	break
			// // }

			if content == "" && stopReason == "" {
				fmt.Printf("== role: %v\n", chunk.Choices[0].Delta)
				streamHandler.HandleAddedItem(chunk)
			}

			if content != "" {
				streamHandler.HandleTextDelta(chunk)
			}

			if content, ok := acc.JustFinishedContent(); ok {
				println("finished content: " + content)
				appendAssistantTextResponse(&openaiChatHistory, &inappChatHistory, content)
				streamHandler.HandleTextDoneItem(chunk, content)
			}

			if tool, ok := acc.JustFinishedToolCall(); ok {
				println("finished tool call: " + tool.Name)
				toolCalls = append(toolCalls, tool)
				streamHandler.HandleToolArgPreparedDoneItem(chunk, toolCalls)
			}

			if refusal, ok := acc.JustFinishedRefusal(); ok {
				fmt.Printf("refusal: %+v\n", refusal)
			}
			// switch chunk.Event {
			// // case "response.output_item.added":
			// // streamHandler.HandleAddedItem(chunk)
			// case "response.incomplete":
			// 	// incomplete happens after "output_item.done" (if it happens)
			// 	// It's an indicator that the response is incomplete.
			// 	openaiOutput = chunk.Response.Output
			// 	streamHandler.SendIncompleteIndicator(chunk.Response.IncompleteDetails.Reason, chunk.Response.ID)
			// case "response.completed": // JustFinishedContent
			// 	openaiOutput = chunk.Response.Output
			// case "response.output_text.delta":
			// 	streamHandler.HandleTextDelta(chunk)
			// }
		}

		if err := stream.Err(); err != nil {
			return nil, nil, err
		}

		// 执行调用（如果有），返回增量数据
		openaiToolHistory, inappToolHistory, err := a.toolCallHandler.HandleToolCalls(ctx, toolCalls, streamHandler)
		if err != nil {
			return nil, nil, err
		}

		// // 把工具调用结果记录下来
		if len(openaiToolHistory) > 0 {
			openaiChatHistory = append(openaiChatHistory, openaiToolHistory...)
			inappChatHistory = append(inappChatHistory, inappToolHistory...)
		} else {
			// response stream is finished, if there is no tool call, then break
			break
		}
	}
	println("openaiChatHistory: ", openaiChatHistory)

	return openaiChatHistory, inappChatHistory, nil
}
