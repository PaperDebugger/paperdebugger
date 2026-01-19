package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"paperdebugger/internal/services/toolkit/registry"
	chatv2 "paperdebugger/pkg/gen/api/chat/v2"
	"strings"
	"time"

	"github.com/openai/openai-go/v3"
)

// ToolCallHandler is responsible for handling tool calls by dispatching them to the appropriate tool registry
// and managing the chat history for both OpenAI and in-app chat systems.
type ToolCallHandlerV2 struct {
	Registry *registry.ToolRegistryV2 // Registry containing available tools for function calls
}

func NewToolCallHandlerV2(toolRegistry *registry.ToolRegistryV2) *ToolCallHandlerV2 {
	return &ToolCallHandlerV2{
		Registry: toolRegistry,
	}
}

type OpenAIChatHistory []openai.ChatCompletionMessageParamUnion
type AppChatHistory []chatv2.Message

// HandleToolCalls processes a list of tool call outputs, invokes the corresponding tools, and constructs
// both OpenAI and in-app chat histories reflecting the tool call and its result.
//
// Parameters:
// ctx:           The context for cancellation and deadlines.
// outputs:       A slice of ResponseOutputItemUnion representing outputs from the model, possibly containing tool calls.
// streamHandler: Optional handler for streaming tool call events (can be nil).
//
// Returns:
//   - openaiChatHistory: The OpenAI-compatible chat history including tool call and output items.
//   - inappChatHistory:  The in-app chat history as a slice of chatv2.Message, reflecting tool call events.
//   - error:             Any error encountered during processing (always nil in current implementation).
func (h *ToolCallHandlerV2) HandleToolCallsV2(ctx context.Context, toolCalls []openai.FinishedChatCompletionToolCall, streamHandler *StreamHandlerV2) (OpenAIChatHistory, AppChatHistory, error) {
	if len(toolCalls) == 0 {
		return nil, nil, nil
	}

	openaiChatHistory := []openai.ChatCompletionMessageParamUnion{} // Accumulates OpenAI chat history items
	inappChatHistory := []chatv2.Message{}                          // Accumulates in-app chat history messages

	toolCallsParam := make([]openai.ChatCompletionMessageToolCallUnionParam, len(toolCalls))
	for i, toolCall := range toolCalls {
		toolCallsParam[i] = openai.ChatCompletionMessageToolCallUnionParam{
			OfFunction: &openai.ChatCompletionMessageFunctionToolCallParam{
				ID:   toolCall.ID,
				Type: "function",
				Function: openai.ChatCompletionMessageFunctionToolCallFunctionParam{
					Name:      toolCall.Name,
					Arguments: toolCall.Arguments,
				},
			},
		}
	}

	openaiChatHistory = append(openaiChatHistory, openai.ChatCompletionMessageParamUnion{
		OfAssistant: &openai.ChatCompletionAssistantMessageParam{
			ToolCalls: toolCallsParam,
		},
	})

	// Iterate over each output item to process tool calls
	for _, toolCall := range toolCalls {
		if streamHandler != nil {
			streamHandler.SendToolCallBegin(toolCall)
		}

		toolResult, err := h.Registry.Call(ctx, toolCall.ID, toolCall.Name, []byte(toolCall.Arguments))

		// Try to parse as XtraMCP ToolResult format
		// This allows XtraMCP tools to use the new format while other tools continue with existing behavior
		// NOTE: there is a bit of a coupled ugly logic here. (TODO: consider new API design later)
		// 0. call method assumes it will return of format llm_content, error where llm_content is used for both frontend and openai history tracking
		//		But for better user display, we might want to distinguish between frontend display and llm context update
		// 1. We rely on the xtramcp/tool_v2.go call method to return "" for LLM instruction. We will construct the LLM instruction based on llm_content.
		// 2. so in registry/registry_v2.go, the returned toolResult is the raw string from the tool execution
		// 3. presently, it is not possible to do the parsing earlier in xtramcp/tool_v2.go because of the following branching logic
		parsedXtraMCPResult, isXtraMCPFormat, parseErr := ParseXtraMCPToolResult(toolResult)

		var llmContent string         // Content to send to LLM (OpenAI chat history)
		var frontendToolResult string // Content to send to frontend (via stream)

		if parseErr != nil || !isXtraMCPFormat {
			// for non-XtraMCP tool - use existing behavior unchanged
			llmContent = toolResult
			frontendToolResult = toolResult
		} else {
			// XtraMCP ToolResult format detected - apply specialized logic

			// BRANCH 1: Handle errors (success=false)
			if !parsedXtraMCPResult.Success {
				// Send error message to LLM
				if parsedXtraMCPResult.Error != nil {
					llmContent = *parsedXtraMCPResult.Error
				} else {
					llmContent = "Tool execution failed (no error message provided)"
				}

				// Send error payload to frontend
				frontendPayload := map[string]interface{}{
					"schema_version": parsedXtraMCPResult.SchemaVersion,
					"display_mode":   parsedXtraMCPResult.DisplayMode,
					"success":        false,
					"metadata":       parsedXtraMCPResult.Metadata,
				}
				if parsedXtraMCPResult.Error != nil {
					frontendPayload["error"] = *parsedXtraMCPResult.Error
				}
				frontendBytes, _ := json.Marshal(frontendPayload)
				frontendToolResult = string(frontendBytes)

			} else if parsedXtraMCPResult.DisplayMode == "verbatim" {
				// BRANCH 2: Verbatim mode (success=true)

				// check if content is truncated, use full_content if available for updating LLM context
				contentForLLM := parsedXtraMCPResult.GetFullContentAsString()

				//TODO better handle this: truncate if too long for LLM context
				// this is a SAFEGUARD against extremely long tool outputs
				// est 30k tokens, 4 chars/token = 120k chars
				const maxLLMContentLen = 120000
				contentForLLM = TruncateContent(contentForLLM, maxLLMContentLen)

				// If instructions provided, send as structured payload
				// Otherwise send raw content
				if parsedXtraMCPResult.Instructions != nil && strings.TrimSpace(*parsedXtraMCPResult.Instructions) != "" {
					llmContent = FormatPrompt(
						toolCall.Name,
						*parsedXtraMCPResult.Instructions,
						parsedXtraMCPResult.GetMetadataValuesAsString(),
						contentForLLM,
					)
				} else {
					llmContent = contentForLLM
				}

				frontendMetadata := make(map[string]interface{})
				if parsedXtraMCPResult.Metadata != nil {
					for k, v := range parsedXtraMCPResult.Metadata {
						frontendMetadata[k] = v
					}
				}

				frontendPayload := map[string]interface{}{
					"schema_version": parsedXtraMCPResult.SchemaVersion,
					"display_mode":   "verbatim",
					"content":        parsedXtraMCPResult.GetContentAsString(),
					"success":        true,
				}
				if len(frontendMetadata) > 0 {
					frontendPayload["metadata"] = frontendMetadata
				}
				frontendBytes, _ := json.Marshal(frontendPayload)
				frontendToolResult = string(frontendBytes)

			} else if parsedXtraMCPResult.DisplayMode == "interpret" {
				// BRANCH 3: Interpret mode (success=true)

				// LLM gets content + optional instructions for reformatting
				if parsedXtraMCPResult.Instructions != nil && strings.TrimSpace(*parsedXtraMCPResult.Instructions) != "" {
					llmContent = FormatPrompt(
						toolCall.Name,
						*parsedXtraMCPResult.Instructions,
						parsedXtraMCPResult.GetMetadataValuesAsString(),
						parsedXtraMCPResult.GetFullContentAsString(),
					)
				} else {
					llmContent = parsedXtraMCPResult.GetFullContentAsString()
				}

				// Frontend gets minimal display (LLM will provide formatted response)
				frontendPayload := map[string]interface{}{
					"schema_version": parsedXtraMCPResult.SchemaVersion,
					"display_mode":   "interpret",
					"success":        true,
				}
				if parsedXtraMCPResult.Metadata != nil {
					frontendPayload["metadata"] = parsedXtraMCPResult.Metadata
				}
				frontendBytes, _ := json.Marshal(frontendPayload)
				frontendToolResult = string(frontendBytes)
			}
		}

		// Send result to stream handler (frontend)
		if streamHandler != nil {
			streamHandler.SendToolCallEnd(toolCall, frontendToolResult, err)
		}

		// Prepare content for LLM (OpenAI chat history)
		resultStr := llmContent
		if err != nil {
			// Tool execution error (different from ToolResult.success=false)
			resultStr = "Error: " + err.Error()
		}

		openaiChatHistory = append(openaiChatHistory, openai.ChatCompletionMessageParamUnion{
			OfTool: &openai.ChatCompletionToolMessageParam{
				Role:       "tool",
				ToolCallID: toolCall.ID,
				Content: openai.ChatCompletionToolMessageParamContentUnion{
					OfArrayOfContentParts: []openai.ChatCompletionContentPartTextParam{
						{
							Type: "text",
							Text: resultStr,
						},
						// {
						// 	Type:     "image_url",
						// 	ImageURL: "xxx"
						// },
					},
				},
			},
		})

		toolCallMsg := &chatv2.MessageTypeToolCall{
			Name: toolCall.Name,
			Args: toolCall.Arguments,
		}
		if err != nil {
			toolCallMsg.Error = err.Error()
		} else {
			toolCallMsg.Result = frontendToolResult
		}

		inappChatHistory = append(inappChatHistory, chatv2.Message{
			MessageId: fmt.Sprintf("openai_toolCall[%d]_%s", toolCall.Index, toolCall.ID),
			Payload: &chatv2.MessagePayload{
				MessageType: &chatv2.MessagePayload_ToolCall{
					ToolCall: toolCallMsg,
				},
			},
			Timestamp: time.Now().Unix(),
		})
	}

	// Return both chat histories and nil error (no error aggregation in this implementation)
	return openaiChatHistory, inappChatHistory, nil
}
