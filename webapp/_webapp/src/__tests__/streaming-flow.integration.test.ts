/**
 * Integration Tests for Streaming Flow
 *
 * Tests the complete streaming flow from request to UI update,
 * including happy paths and error scenarios.
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import { useStreamingStateMachine } from "../stores/streaming/streaming-state-machine";
import { useMessageStore } from "../stores/message-store";
import { mapResponseToStreamEvent } from "../utils/stream-event-mapper";
import {
  buildStreamRequest,
  validateStreamRequestParams,
} from "../utils/stream-request-builder";
import { StreamEvent } from "../stores/streaming/types";

// Mock external dependencies
mock.module("../stores/conversation/conversation-store", () => ({
  useConversationStore: {
    getState: () => ({
      updateCurrentConversation: mock(() => {}),
      currentConversation: { messages: [], id: "", modelSlug: "" },
    }),
    subscribe: mock(() => () => {}),
  },
}));

mock.module("../libs/logger", () => ({
  logError: mock(() => {}),
  logWarn: mock(() => {}),
  logInfo: mock(() => {}),
}));

mock.module("../query/api", () => ({
  getConversation: mock(async () => ({ conversation: null })),
}));

describe("Streaming Flow Integration", () => {
  beforeEach(() => {
    useStreamingStateMachine.getState().reset();
  });

  describe("Stream Request Building", () => {
    it("should build valid request from parameters", () => {
      const params = {
        message: "Hello",
        selectedText: "some text",
        projectId: "proj-123",
        conversationId: "conv-456",
        modelSlug: "gpt-4",
        conversationMode: "default" as const,
      };

      const request = buildStreamRequest(params);

      expect(request.projectId).toBe("proj-123");
      expect(request.conversationId).toBe("conv-456");
      expect(request.modelSlug).toBe("gpt-4");
      expect(request.userMessage).toBe("Hello");
      expect(request.userSelectedText).toBe("some text");
    });

    it("should validate required parameters", () => {
      // Missing message
      expect(validateStreamRequestParams({ projectId: "1", conversationId: "2", modelSlug: "3" }).valid).toBe(false);

      // Missing projectId
      expect(validateStreamRequestParams({ message: "hi", conversationId: "2", modelSlug: "3" }).valid).toBe(false);

      // Valid parameters
      expect(
        validateStreamRequestParams({
          message: "Hello",
          projectId: "proj-123",
          conversationId: "conv-456",
          modelSlug: "gpt-4",
        }).valid
      ).toBe(true);
    });
  });

  describe("Stream Event Mapping", () => {
    it("should map streamInitialization response", () => {
      const response = {
        responsePayload: {
          case: "streamInitialization",
          value: { conversationId: "conv-123", modelSlug: "gpt-4" },
        },
      };

      const event = mapResponseToStreamEvent(response as any);

      expect(event).not.toBeNull();
      expect(event!.type).toBe("INIT");
    });

    it("should map streamPartBegin response", () => {
      const response = {
        responsePayload: {
          case: "streamPartBegin",
          value: {
            messageId: "msg-1",
            payload: {
              messageType: {
                case: "assistant",
                value: { content: "" },
              },
            },
          },
        },
      };

      const event = mapResponseToStreamEvent(response as any);

      expect(event).not.toBeNull();
      expect(event!.type).toBe("PART_BEGIN");
    });

    it("should map messageChunk response", () => {
      const response = {
        responsePayload: {
          case: "messageChunk",
          value: { messageId: "msg-1", delta: "Hello" },
        },
      };

      const event = mapResponseToStreamEvent(response as any);

      expect(event).not.toBeNull();
      expect(event!.type).toBe("CHUNK");
    });

    it("should map streamFinalization response", () => {
      const response = {
        responsePayload: {
          case: "streamFinalization",
          value: { conversationId: "conv-123" },
        },
      };

      const event = mapResponseToStreamEvent(response as any);

      expect(event).not.toBeNull();
      expect(event!.type).toBe("FINALIZE");
    });

    it("should map streamError response", () => {
      const response = {
        responsePayload: {
          case: "streamError",
          value: { errorMessage: "Something went wrong" },
        },
      };

      const event = mapResponseToStreamEvent(response as any);

      expect(event).not.toBeNull();
      expect(event!.type).toBe("ERROR");
    });

    it("should return null for undefined payload", () => {
      const response = {
        responsePayload: {
          case: undefined,
          value: undefined,
        },
      };

      const event = mapResponseToStreamEvent(response as any);
      expect(event).toBeNull();
    });
  });

  describe("Complete Streaming Flow", () => {
    it("should handle happy path: INIT → PART_BEGIN → CHUNK → PART_END → FINALIZE", async () => {
      const stateMachine = useStreamingStateMachine.getState();

      // Add user message first
      useStreamingStateMachine.setState({
        streamingMessage: {
          parts: [
            {
              id: "user-1",
              role: "user",
              status: "streaming",
              data: { content: "Hello" },
            },
          ],
          sequence: 1,
        },
      });

      // 1. INIT - Server acknowledges user message
      await stateMachine.handleEvent({
        type: "INIT",
        payload: { conversationId: "conv-123", modelSlug: "gpt-4" } as any,
      });

      expect(useStreamingStateMachine.getState().state).toBe("receiving");

      // 2. PART_BEGIN - Start assistant response
      await stateMachine.handleEvent({
        type: "PART_BEGIN",
        payload: {
          messageId: "assistant-1",
          payload: {
            messageType: {
              case: "assistant",
              value: { content: "", reasoning: "", modelSlug: "gpt-4" },
            },
          },
        } as any,
      });

      const afterBegin = useStreamingStateMachine.getState();
      expect(afterBegin.streamingMessage.parts).toHaveLength(1);
      expect(afterBegin.streamingMessage.parts[0].role).toBe("assistant");

      // 3. CHUNK - Stream content
      await stateMachine.handleEvent({
        type: "CHUNK",
        payload: { messageId: "assistant-1", delta: "Hello " } as any,
      });

      await stateMachine.handleEvent({
        type: "CHUNK",
        payload: { messageId: "assistant-1", delta: "World!" } as any,
      });

      const afterChunks = useStreamingStateMachine.getState();
      const assistantMsg = afterChunks.streamingMessage.parts[0];
      if (assistantMsg.role === "assistant") {
        expect(assistantMsg.data.content).toBe("Hello World!");
      }

      // 4. PART_END - Complete assistant message
      await stateMachine.handleEvent({
        type: "PART_END",
        payload: {
          messageId: "assistant-1",
          payload: {
            messageType: {
              case: "assistant",
              value: { content: "Hello World!", reasoning: "", modelSlug: "gpt-4" },
            },
          },
        } as any,
      });

      const afterEnd = useStreamingStateMachine.getState();
      expect(afterEnd.streamingMessage.parts[0].status).toBe("complete");

      // 5. FINALIZE - Stream complete
      await stateMachine.handleEvent({
        type: "FINALIZE",
        payload: { conversationId: "conv-123" } as any,
      });

      const finalState = useStreamingStateMachine.getState();
      expect(finalState.state).toBe("idle");
      expect(finalState.streamingMessage.parts).toEqual([]);
    });

    it("should handle tool call flow", async () => {
      const stateMachine = useStreamingStateMachine.getState();

      // PART_BEGIN for tool call prepare
      await stateMachine.handleEvent({
        type: "PART_BEGIN",
        payload: {
          messageId: "tool-prep-1",
          payload: {
            messageType: {
              case: "toolCallPrepareArguments",
              value: { name: "search", args: "" },
            },
          },
        } as any,
      });

      expect(useStreamingStateMachine.getState().streamingMessage.parts[0].role).toBe(
        "toolCallPrepare"
      );

      // PART_END for tool call prepare
      await stateMachine.handleEvent({
        type: "PART_END",
        payload: {
          messageId: "tool-prep-1",
          payload: {
            messageType: {
              case: "toolCallPrepareArguments",
              value: { name: "search", args: '{"query": "test"}' },
            },
          },
        } as any,
      });

      // PART_BEGIN for tool call result
      await stateMachine.handleEvent({
        type: "PART_BEGIN",
        payload: {
          messageId: "tool-1",
          payload: {
            messageType: {
              case: "toolCall",
              value: { name: "search", args: '{"query": "test"}', result: "", error: "" },
            },
          },
        } as any,
      });

      expect(useStreamingStateMachine.getState().streamingMessage.parts).toHaveLength(2);

      // PART_END for tool call
      await stateMachine.handleEvent({
        type: "PART_END",
        payload: {
          messageId: "tool-1",
          payload: {
            messageType: {
              case: "toolCall",
              value: {
                name: "search",
                args: '{"query": "test"}',
                result: "Found 3 results",
                error: "",
              },
            },
          },
        } as any,
      });

      const toolCallMsg = useStreamingStateMachine.getState().streamingMessage.parts[1];
      if (toolCallMsg.role === "toolCall") {
        expect(toolCallMsg.data.result).toBe("Found 3 results");
      }
    });

    it("should handle reasoning chunks", async () => {
      const stateMachine = useStreamingStateMachine.getState();

      // Start assistant message
      await stateMachine.handleEvent({
        type: "PART_BEGIN",
        payload: {
          messageId: "assistant-1",
          payload: {
            messageType: {
              case: "assistant",
              value: { content: "", reasoning: "", modelSlug: "gpt-4" },
            },
          },
        } as any,
      });

      // Send reasoning chunks
      await stateMachine.handleEvent({
        type: "REASONING_CHUNK",
        payload: { messageId: "assistant-1", delta: "Let me think" } as any,
      });

      await stateMachine.handleEvent({
        type: "REASONING_CHUNK",
        payload: { messageId: "assistant-1", delta: " about this..." } as any,
      });

      const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
      if (msg.role === "assistant") {
        expect(msg.data.reasoning).toBe("Let me think about this...");
      }
    });
  });

  describe("Error Scenarios", () => {
    it("should handle stream error", async () => {
      const stateMachine = useStreamingStateMachine.getState();

      await stateMachine.handleEvent({
        type: "ERROR",
        payload: { errorMessage: "Rate limit exceeded" } as any,
      });

      const state = useStreamingStateMachine.getState();
      expect(state.state).toBe("error");
    });

    it("should handle connection error", async () => {
      const stateMachine = useStreamingStateMachine.getState();

      // Add a streaming message first
      await stateMachine.handleEvent({
        type: "PART_BEGIN",
        payload: {
          messageId: "msg-1",
          payload: {
            messageType: {
              case: "assistant",
              value: { content: "Hello", reasoning: "", modelSlug: "gpt-4" },
            },
          },
        } as any,
      });

      // Simulate connection error
      await stateMachine.handleEvent({
        type: "CONNECTION_ERROR",
        payload: new Error("Network disconnected"),
      });

      const state = useStreamingStateMachine.getState();
      expect(state.state).toBe("error");
      expect(state.streamingMessage.parts[0].status).toBe("stale");
    });

    it("should handle incomplete indicator", async () => {
      const stateMachine = useStreamingStateMachine.getState();

      await stateMachine.handleEvent({
        type: "INCOMPLETE",
        payload: { reason: "truncated" } as any,
      });

      const indicator = useStreamingStateMachine.getState().incompleteIndicator;
      expect(indicator).not.toBeNull();
    });
  });

  describe("State Transitions", () => {
    it("should follow correct state flow: idle → receiving → finalizing → idle", async () => {
      const stateMachine = useStreamingStateMachine.getState();

      // Initial state
      expect(stateMachine.state).toBe("idle");

      // Add user message and init
      useStreamingStateMachine.setState({
        streamingMessage: {
          parts: [{ id: "user-1", role: "user", status: "streaming", data: { content: "Hi" } }],
          sequence: 1,
        },
      });

      await stateMachine.handleEvent({
        type: "INIT",
        payload: { conversationId: "conv-1", modelSlug: "gpt-4" } as any,
      });
      expect(useStreamingStateMachine.getState().state).toBe("receiving");

      // Add and complete assistant message
      await stateMachine.handleEvent({
        type: "PART_BEGIN",
        payload: {
          messageId: "assistant-1",
          payload: {
            messageType: {
              case: "assistant",
              value: { content: "", reasoning: "", modelSlug: "gpt-4" },
            },
          },
        } as any,
      });

      await stateMachine.handleEvent({
        type: "PART_END",
        payload: {
          messageId: "assistant-1",
          payload: {
            messageType: {
              case: "assistant",
              value: { content: "Hello!", reasoning: "", modelSlug: "gpt-4" },
            },
          },
        } as any,
      });

      // Finalize
      await stateMachine.handleEvent({
        type: "FINALIZE",
        payload: { conversationId: "conv-1" } as any,
      });

      expect(useStreamingStateMachine.getState().state).toBe("idle");
    });

    it("should handle error state transition", async () => {
      await useStreamingStateMachine.getState().handleEvent({
        type: "ERROR",
        payload: { errorMessage: "Fatal error" } as any,
      });

      expect(useStreamingStateMachine.getState().state).toBe("error");
    });
  });

  describe("Sequence Number Management", () => {
    it("should increment sequence on each update", async () => {
      const stateMachine = useStreamingStateMachine.getState();
      const initialSequence = stateMachine.streamingMessage.sequence;

      await stateMachine.handleEvent({
        type: "PART_BEGIN",
        payload: {
          messageId: "msg-1",
          payload: {
            messageType: {
              case: "assistant",
              value: { content: "", reasoning: "", modelSlug: "gpt-4" },
            },
          },
        } as any,
      });

      expect(useStreamingStateMachine.getState().streamingMessage.sequence).toBe(
        initialSequence + 1
      );

      await stateMachine.handleEvent({
        type: "CHUNK",
        payload: { messageId: "msg-1", delta: "Hello" } as any,
      });

      expect(useStreamingStateMachine.getState().streamingMessage.sequence).toBe(
        initialSequence + 2
      );
    });
  });
});
