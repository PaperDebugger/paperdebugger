/**
 * Unit Tests for Streaming State Machine
 *
 * Tests all state transitions and event handling in the streaming state machine.
 */

import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import { useStreamingStateMachine } from "../streaming-state-machine";
import { StreamEvent } from "../types";
import { InternalMessage } from "../../../types/message";

// Mock the conversation store
const mockUpdateCurrentConversation = mock(() => {});
const mockGetState = mock(() => ({ updateCurrentConversation: mockUpdateCurrentConversation }));

mock.module("../../conversation/conversation-store", () => ({
  useConversationStore: {
    getState: mockGetState,
  },
}));

// Mock the logger
mock.module("../../../libs/logger", () => ({
  logError: mock(() => {}),
  logWarn: mock(() => {}),
  logInfo: mock(() => {}),
}));

// Mock query API
mock.module("../../../query/api", () => ({
  getConversation: mock(async () => ({ conversation: null })),
}));

describe("useStreamingStateMachine", () => {
  beforeEach(() => {
    // Reset the store state before each test
    useStreamingStateMachine.getState().reset();
    mockUpdateCurrentConversation.mockClear();
  });

  describe("Initial State", () => {
    it("should start in idle state", () => {
      const state = useStreamingStateMachine.getState();
      expect(state.state).toBe("idle");
    });

    it("should have empty streaming message", () => {
      const state = useStreamingStateMachine.getState();
      expect(state.streamingMessage.parts).toEqual([]);
      expect(state.streamingMessage.sequence).toBe(0);
    });

    it("should have null incomplete indicator", () => {
      const state = useStreamingStateMachine.getState();
      expect(state.incompleteIndicator).toBeNull();
    });
  });

  describe("reset()", () => {
    it("should reset all state to initial values", async () => {
      // First, change some state
      const event: StreamEvent = {
        type: "PART_BEGIN",
        payload: {
          messageId: "test-id",
          payload: {
            messageType: {
              case: "assistant",
              value: { content: "Hello", reasoning: "", modelSlug: "gpt-4" },
            },
          },
        } as any,
      };
      await useStreamingStateMachine.getState().handleEvent(event);

      // Verify state changed
      expect(useStreamingStateMachine.getState().streamingMessage.parts.length).toBeGreaterThan(0);

      // Reset
      useStreamingStateMachine.getState().reset();

      // Verify state is reset
      const state = useStreamingStateMachine.getState();
      expect(state.state).toBe("idle");
      expect(state.streamingMessage.parts).toEqual([]);
      expect(state.streamingMessage.sequence).toBe(0);
      expect(state.incompleteIndicator).toBeNull();
    });
  });

  describe("INIT Event", () => {
    it("should finalize user messages and change state to receiving", async () => {
      // Add a user message first
      useStreamingStateMachine.setState({
        streamingMessage: {
          parts: [
            {
              id: "user-1",
              role: "user",
              status: "streaming",
              data: { content: "Hello" },
            } as InternalMessage,
          ],
          sequence: 1,
        },
      });

      const event: StreamEvent = {
        type: "INIT",
        payload: {
          conversationId: "conv-123",
          modelSlug: "gpt-4",
        } as any,
      };

      await useStreamingStateMachine.getState().handleEvent(event);

      const state = useStreamingStateMachine.getState();
      expect(state.state).toBe("receiving");
      // After INIT, streaming message should be reset
      expect(state.streamingMessage.parts).toEqual([]);
    });
  });

  describe("PART_BEGIN Event", () => {
    it("should add assistant message to streaming parts", async () => {
      const event: StreamEvent = {
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
      };

      await useStreamingStateMachine.getState().handleEvent(event);

      const state = useStreamingStateMachine.getState();
      expect(state.streamingMessage.parts).toHaveLength(1);
      expect(state.streamingMessage.parts[0].id).toBe("msg-1");
      expect(state.streamingMessage.parts[0].role).toBe("assistant");
      expect(state.streamingMessage.parts[0].status).toBe("streaming");
    });

    it("should add toolCall message to streaming parts", async () => {
      const event: StreamEvent = {
        type: "PART_BEGIN",
        payload: {
          messageId: "tool-1",
          payload: {
            messageType: {
              case: "toolCall",
              value: { name: "search", args: "{}", result: "", error: "" },
            },
          },
        } as any,
      };

      await useStreamingStateMachine.getState().handleEvent(event);

      const state = useStreamingStateMachine.getState();
      expect(state.streamingMessage.parts).toHaveLength(1);
      expect(state.streamingMessage.parts[0].role).toBe("toolCall");
    });

    it("should add toolCallPrepareArguments message to streaming parts", async () => {
      const event: StreamEvent = {
        type: "PART_BEGIN",
        payload: {
          messageId: "prep-1",
          payload: {
            messageType: {
              case: "toolCallPrepareArguments",
              value: { name: "search", args: "" },
            },
          },
        } as any,
      };

      await useStreamingStateMachine.getState().handleEvent(event);

      const state = useStreamingStateMachine.getState();
      expect(state.streamingMessage.parts).toHaveLength(1);
      expect(state.streamingMessage.parts[0].role).toBe("toolCallPrepare");
    });

    it("should not add duplicate messages", async () => {
      const event: StreamEvent = {
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
      };

      // Send same event twice
      await useStreamingStateMachine.getState().handleEvent(event);
      await useStreamingStateMachine.getState().handleEvent(event);

      const state = useStreamingStateMachine.getState();
      expect(state.streamingMessage.parts).toHaveLength(1);
    });

    it("should ignore user, system, and unknown roles", async () => {
      for (const role of ["user", "system", "unknown"]) {
        useStreamingStateMachine.getState().reset();
        
        const event: StreamEvent = {
          type: "PART_BEGIN",
          payload: {
            messageId: `${role}-1`,
            payload: {
              messageType: {
                case: role,
                value: { content: "test" },
              },
            },
          } as any,
        };

        await useStreamingStateMachine.getState().handleEvent(event);

        const state = useStreamingStateMachine.getState();
        expect(state.streamingMessage.parts).toHaveLength(0);
      }
    });
  });

  describe("CHUNK Event", () => {
    it("should append delta to assistant message content", async () => {
      // First add an assistant message
      const beginEvent: StreamEvent = {
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
      };
      await useStreamingStateMachine.getState().handleEvent(beginEvent);

      // Then send a chunk
      const chunkEvent: StreamEvent = {
        type: "CHUNK",
        payload: {
          messageId: "msg-1",
          delta: " World",
        } as any,
      };
      await useStreamingStateMachine.getState().handleEvent(chunkEvent);

      const state = useStreamingStateMachine.getState();
      const message = state.streamingMessage.parts[0];
      expect(message.role).toBe("assistant");
      if (message.role === "assistant") {
        expect(message.data.content).toBe("Hello World");
      }
    });

    it("should increment sequence number", async () => {
      const beginEvent: StreamEvent = {
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
      };
      await useStreamingStateMachine.getState().handleEvent(beginEvent);
      const sequenceAfterBegin = useStreamingStateMachine.getState().streamingMessage.sequence;

      const chunkEvent: StreamEvent = {
        type: "CHUNK",
        payload: { messageId: "msg-1", delta: "a" } as any,
      };
      await useStreamingStateMachine.getState().handleEvent(chunkEvent);

      expect(useStreamingStateMachine.getState().streamingMessage.sequence).toBe(
        sequenceAfterBegin + 1
      );
    });
  });

  describe("REASONING_CHUNK Event", () => {
    it("should append delta to assistant message reasoning", async () => {
      // First add an assistant message
      const beginEvent: StreamEvent = {
        type: "PART_BEGIN",
        payload: {
          messageId: "msg-1",
          payload: {
            messageType: {
              case: "assistant",
              value: { content: "", reasoning: "Initial", modelSlug: "gpt-4" },
            },
          },
        } as any,
      };
      await useStreamingStateMachine.getState().handleEvent(beginEvent);

      // Then send a reasoning chunk
      const reasoningEvent: StreamEvent = {
        type: "REASONING_CHUNK",
        payload: {
          messageId: "msg-1",
          delta: " reasoning",
        } as any,
      };
      await useStreamingStateMachine.getState().handleEvent(reasoningEvent);

      const state = useStreamingStateMachine.getState();
      const message = state.streamingMessage.parts[0];
      expect(message.role).toBe("assistant");
      if (message.role === "assistant") {
        expect(message.data.reasoning).toBe("Initial reasoning");
      }
    });
  });

  describe("PART_END Event", () => {
    it("should finalize assistant message with status complete", async () => {
      // First add an assistant message
      const beginEvent: StreamEvent = {
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
      };
      await useStreamingStateMachine.getState().handleEvent(beginEvent);

      // Then end the part
      const endEvent: StreamEvent = {
        type: "PART_END",
        payload: {
          messageId: "msg-1",
          payload: {
            messageType: {
              case: "assistant",
              value: { content: "Hello World!", reasoning: "Done", modelSlug: "gpt-4" },
            },
          },
        } as any,
      };
      await useStreamingStateMachine.getState().handleEvent(endEvent);

      const state = useStreamingStateMachine.getState();
      const message = state.streamingMessage.parts[0];
      expect(message.status).toBe("complete");
      if (message.role === "assistant") {
        expect(message.data.content).toBe("Hello World!");
        expect(message.data.reasoning).toBe("Done");
      }
    });

    it("should finalize toolCall message", async () => {
      const beginEvent: StreamEvent = {
        type: "PART_BEGIN",
        payload: {
          messageId: "tool-1",
          payload: {
            messageType: {
              case: "toolCall",
              value: { name: "search", args: "{}", result: "", error: "" },
            },
          },
        } as any,
      };
      await useStreamingStateMachine.getState().handleEvent(beginEvent);

      const endEvent: StreamEvent = {
        type: "PART_END",
        payload: {
          messageId: "tool-1",
          payload: {
            messageType: {
              case: "toolCall",
              value: { name: "search", args: '{"q":"test"}', result: "Found!", error: "" },
            },
          },
        } as any,
      };
      await useStreamingStateMachine.getState().handleEvent(endEvent);

      const state = useStreamingStateMachine.getState();
      const message = state.streamingMessage.parts[0];
      expect(message.status).toBe("complete");
      if (message.role === "toolCall") {
        expect(message.data.result).toBe("Found!");
      }
    });
  });

  describe("FINALIZE Event", () => {
    it("should change state to idle and clear streaming message", async () => {
      // Add some streaming messages first
      const beginEvent: StreamEvent = {
        type: "PART_BEGIN",
        payload: {
          messageId: "msg-1",
          payload: {
            messageType: {
              case: "assistant",
              value: { content: "Test", reasoning: "", modelSlug: "gpt-4" },
            },
          },
        } as any,
      };
      await useStreamingStateMachine.getState().handleEvent(beginEvent);

      // Mark as complete
      const endEvent: StreamEvent = {
        type: "PART_END",
        payload: {
          messageId: "msg-1",
          payload: {
            messageType: {
              case: "assistant",
              value: { content: "Test", reasoning: "", modelSlug: "gpt-4" },
            },
          },
        } as any,
      };
      await useStreamingStateMachine.getState().handleEvent(endEvent);

      // Finalize
      const finalizeEvent: StreamEvent = {
        type: "FINALIZE",
        payload: { conversationId: "conv-123" } as any,
      };
      await useStreamingStateMachine.getState().handleEvent(finalizeEvent);

      const state = useStreamingStateMachine.getState();
      expect(state.state).toBe("idle");
      expect(state.streamingMessage.parts).toEqual([]);
      expect(state.streamingMessage.sequence).toBe(0);
    });
  });

  describe("INCOMPLETE Event", () => {
    it("should set incomplete indicator", async () => {
      const event: StreamEvent = {
        type: "INCOMPLETE",
        payload: { reason: "truncated" } as any,
      };

      await useStreamingStateMachine.getState().handleEvent(event);

      const state = useStreamingStateMachine.getState();
      expect(state.incompleteIndicator).not.toBeNull();
    });
  });

  describe("CONNECTION_ERROR Event", () => {
    it("should mark streaming messages as stale", async () => {
      // Add a streaming message
      const beginEvent: StreamEvent = {
        type: "PART_BEGIN",
        payload: {
          messageId: "msg-1",
          payload: {
            messageType: {
              case: "assistant",
              value: { content: "Test", reasoning: "", modelSlug: "gpt-4" },
            },
          },
        } as any,
      };
      await useStreamingStateMachine.getState().handleEvent(beginEvent);

      // Connection error
      const errorEvent: StreamEvent = {
        type: "CONNECTION_ERROR",
        payload: new Error("Network error"),
      };
      await useStreamingStateMachine.getState().handleEvent(errorEvent);

      const state = useStreamingStateMachine.getState();
      expect(state.state).toBe("error");
      expect(state.streamingMessage.parts[0].status).toBe("stale");
    });

    it("should not change complete messages to stale", async () => {
      // Add and complete a message
      useStreamingStateMachine.setState({
        streamingMessage: {
          parts: [
            {
              id: "msg-1",
              role: "assistant",
              status: "complete",
              data: { content: "Done" },
            } as InternalMessage,
          ],
          sequence: 1,
        },
      });

      const errorEvent: StreamEvent = {
        type: "CONNECTION_ERROR",
        payload: new Error("Network error"),
      };
      await useStreamingStateMachine.getState().handleEvent(errorEvent);

      const state = useStreamingStateMachine.getState();
      expect(state.streamingMessage.parts[0].status).toBe("complete");
    });
  });

  describe("Selectors", () => {
    it("getStreamingMessage should return current streaming message", () => {
      const message = useStreamingStateMachine.getState().getStreamingMessage();
      expect(message).toEqual({ parts: [], sequence: 0 });
    });

    it("getIncompleteIndicator should return current incomplete indicator", () => {
      const indicator = useStreamingStateMachine.getState().getIncompleteIndicator();
      expect(indicator).toBeNull();
    });
  });
});
