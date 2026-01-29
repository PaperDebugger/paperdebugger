/**
 * Unit Tests for Message Type Handlers
 *
 * Tests the handler registry and individual message type handlers.
 */

import { describe, it, expect } from "bun:test";
import {
  getMessageTypeHandler,
  isValidMessageRole,
  messageTypeHandlers,
} from "../message-type-handlers";
import { InternalMessage, MessageRole } from "../types";

// Mock protobuf types
const createMockStreamPartBegin = (
  messageId: string,
  role: MessageRole,
  value: Record<string, unknown>
) => ({
  messageId,
  payload: {
    messageType: {
      case: role,
      value,
    },
  },
});

const createMockStreamPartEnd = (
  messageId: string,
  role: MessageRole,
  value: Record<string, unknown>
) => ({
  messageId,
  payload: {
    messageType: {
      case: role,
      value,
    },
  },
});

describe("Message Type Handlers", () => {
  describe("isValidMessageRole", () => {
    it("should return true for valid roles", () => {
      const validRoles: MessageRole[] = [
        "assistant",
        "toolCallPrepareArguments",
        "toolCall",
        "user",
        "system",
        "unknown",
      ];

      for (const role of validRoles) {
        expect(isValidMessageRole(role)).toBe(true);
      }
    });

    it("should return false for invalid roles", () => {
      expect(isValidMessageRole("invalid")).toBe(false);
      expect(isValidMessageRole("")).toBe(false);
      expect(isValidMessageRole(null)).toBe(false);
      expect(isValidMessageRole(undefined)).toBe(false);
      expect(isValidMessageRole(123)).toBe(false);
    });
  });

  describe("getMessageTypeHandler", () => {
    it("should return correct handler for each role", () => {
      const roles: MessageRole[] = [
        "assistant",
        "toolCallPrepareArguments",
        "toolCall",
        "user",
        "system",
        "unknown",
      ];

      for (const role of roles) {
        const handler = getMessageTypeHandler(role);
        expect(handler).toBeDefined();
        expect(typeof handler.onPartBegin).toBe("function");
        expect(typeof handler.onPartEnd).toBe("function");
      }
    });

    it("should return NoOpHandler for undefined role", () => {
      const handler = getMessageTypeHandler(undefined);
      expect(handler.onPartBegin({} as any)).toBeNull();
    });
  });

  describe("AssistantHandler", () => {
    const handler = messageTypeHandlers.assistant;

    describe("onPartBegin", () => {
      it("should create assistant message from StreamPartBegin", () => {
        const partBegin = createMockStreamPartBegin("msg-1", "assistant", {
          content: "Hello",
          reasoning: "Thinking...",
          modelSlug: "gpt-4",
        });

        const result = handler.onPartBegin(partBegin as any);

        expect(result).not.toBeNull();
        expect(result!.id).toBe("msg-1");
        expect(result!.role).toBe("assistant");
        expect(result!.status).toBe("streaming");
        if (result!.role === "assistant") {
          expect(result!.data.content).toBe("Hello");
          expect(result!.data.reasoning).toBe("Thinking...");
          expect(result!.data.modelSlug).toBe("gpt-4");
        }
      });
    });

    describe("onPartEnd", () => {
      it("should finalize assistant message", () => {
        const existingMessage: InternalMessage = {
          id: "msg-1",
          role: "assistant",
          status: "streaming",
          data: { content: "Hello", reasoning: "" },
        };

        const partEnd = createMockStreamPartEnd("msg-1", "assistant", {
          content: "Hello World!",
          reasoning: "Done thinking",
          modelSlug: "gpt-4",
        });

        const result = handler.onPartEnd(partEnd as any, existingMessage);

        expect(result).not.toBeNull();
        expect(result!.status).toBe("complete");
        if (result!.role === "assistant") {
          expect(result!.data.content).toBe("Hello World!");
          expect(result!.data.reasoning).toBe("Done thinking");
        }
      });

      it("should return null for non-assistant messages", () => {
        const existingMessage: InternalMessage = {
          id: "msg-1",
          role: "user",
          status: "streaming",
          data: { content: "Hello" },
        };

        const partEnd = createMockStreamPartEnd("msg-1", "assistant", {
          content: "Response",
        });

        const result = handler.onPartEnd(partEnd as any, existingMessage);
        expect(result).toBeNull();
      });
    });
  });

  describe("ToolCallPrepareHandler", () => {
    const handler = messageTypeHandlers.toolCallPrepareArguments;

    describe("onPartBegin", () => {
      it("should create toolCallPrepare message from StreamPartBegin", () => {
        const partBegin = createMockStreamPartBegin(
          "tool-prep-1",
          "toolCallPrepareArguments",
          {
            name: "search",
            args: '{"query":',
          }
        );

        const result = handler.onPartBegin(partBegin as any);

        expect(result).not.toBeNull();
        expect(result!.id).toBe("tool-prep-1");
        expect(result!.role).toBe("toolCallPrepare");
        expect(result!.status).toBe("streaming");
        if (result!.role === "toolCallPrepare") {
          expect(result!.data.name).toBe("search");
          expect(result!.data.args).toBe('{"query":');
        }
      });
    });

    describe("onPartEnd", () => {
      it("should finalize toolCallPrepare message", () => {
        const existingMessage: InternalMessage = {
          id: "tool-prep-1",
          role: "toolCallPrepare",
          status: "streaming",
          data: { name: "search", args: "" },
        };

        const partEnd = createMockStreamPartEnd(
          "tool-prep-1",
          "toolCallPrepareArguments",
          {
            name: "search",
            args: '{"query": "test"}',
          }
        );

        const result = handler.onPartEnd(partEnd as any, existingMessage);

        expect(result).not.toBeNull();
        expect(result!.status).toBe("complete");
        if (result!.role === "toolCallPrepare") {
          expect(result!.data.args).toBe('{"query": "test"}');
        }
      });

      it("should return null for non-toolCallPrepare messages", () => {
        const existingMessage: InternalMessage = {
          id: "msg-1",
          role: "assistant",
          status: "streaming",
          data: { content: "Hello" },
        };

        const partEnd = createMockStreamPartEnd(
          "msg-1",
          "toolCallPrepareArguments",
          {
            name: "search",
            args: "{}",
          }
        );

        const result = handler.onPartEnd(partEnd as any, existingMessage);
        expect(result).toBeNull();
      });
    });
  });

  describe("ToolCallHandler", () => {
    const handler = messageTypeHandlers.toolCall;

    describe("onPartBegin", () => {
      it("should create toolCall message from StreamPartBegin", () => {
        const partBegin = createMockStreamPartBegin("tool-1", "toolCall", {
          name: "search",
          args: '{"query": "test"}',
          result: "",
          error: "",
        });

        const result = handler.onPartBegin(partBegin as any);

        expect(result).not.toBeNull();
        expect(result!.id).toBe("tool-1");
        expect(result!.role).toBe("toolCall");
        expect(result!.status).toBe("streaming");
        if (result!.role === "toolCall") {
          expect(result!.data.name).toBe("search");
          expect(result!.data.args).toBe('{"query": "test"}');
        }
      });
    });

    describe("onPartEnd", () => {
      it("should finalize toolCall message with result", () => {
        const existingMessage: InternalMessage = {
          id: "tool-1",
          role: "toolCall",
          status: "streaming",
          data: { name: "search", args: "{}", result: "", error: "" },
        };

        const partEnd = createMockStreamPartEnd("tool-1", "toolCall", {
          name: "search",
          args: '{"query": "test"}',
          result: "Found 3 results",
          error: "",
        });

        const result = handler.onPartEnd(partEnd as any, existingMessage);

        expect(result).not.toBeNull();
        expect(result!.status).toBe("complete");
        if (result!.role === "toolCall") {
          expect(result!.data.result).toBe("Found 3 results");
          expect(result!.data.error).toBe("");
        }
      });

      it("should finalize toolCall message with error", () => {
        const existingMessage: InternalMessage = {
          id: "tool-1",
          role: "toolCall",
          status: "streaming",
          data: { name: "search", args: "{}", result: "", error: "" },
        };

        const partEnd = createMockStreamPartEnd("tool-1", "toolCall", {
          name: "search",
          args: "{}",
          result: "",
          error: "Tool not found",
        });

        const result = handler.onPartEnd(partEnd as any, existingMessage);

        expect(result).not.toBeNull();
        if (result!.role === "toolCall") {
          expect(result!.data.error).toBe("Tool not found");
        }
      });

      it("should return null for non-toolCall messages", () => {
        const existingMessage: InternalMessage = {
          id: "msg-1",
          role: "assistant",
          status: "streaming",
          data: { content: "Hello" },
        };

        const partEnd = createMockStreamPartEnd("msg-1", "toolCall", {
          name: "search",
          args: "{}",
        });

        const result = handler.onPartEnd(partEnd as any, existingMessage);
        expect(result).toBeNull();
      });
    });
  });

  describe("NoOpHandler (user, system, unknown)", () => {
    const noOpRoles: MessageRole[] = ["user", "system", "unknown"];

    for (const role of noOpRoles) {
      describe(`${role} handler`, () => {
        const handler = messageTypeHandlers[role];

        it("should return null on partBegin", () => {
          const partBegin = createMockStreamPartBegin("msg-1", role, {
            content: "test",
          });

          const result = handler.onPartBegin(partBegin as any);
          expect(result).toBeNull();
        });

        it("should return null on partEnd", () => {
          const existingMessage: InternalMessage = {
            id: "msg-1",
            role: "user",
            status: "streaming",
            data: { content: "test" },
          };

          const partEnd = createMockStreamPartEnd("msg-1", role, {
            content: "test",
          });

          const result = handler.onPartEnd(partEnd as any, existingMessage);
          expect(result).toBeNull();
        });
      });
    }
  });

  describe("Handler Registry", () => {
    it("should have handlers for all valid roles", () => {
      const roles: MessageRole[] = [
        "assistant",
        "toolCallPrepareArguments",
        "toolCall",
        "user",
        "system",
        "unknown",
      ];

      for (const role of roles) {
        expect(messageTypeHandlers[role]).toBeDefined();
      }
    });

    it("should return same handler instance for same role", () => {
      const handler1 = getMessageTypeHandler("assistant");
      const handler2 = getMessageTypeHandler("assistant");
      expect(handler1).toBe(handler2);
    });
  });
});
