/**
 * Unit Tests for Message Converters
 *
 * Tests bidirectional conversion between API types, InternalMessage, and DisplayMessage.
 */

import { describe, it, expect } from "bun:test";
import {
  fromApiMessage,
  toApiMessage,
  fromStreamPartBegin,
  applyStreamPartEnd,
  toDisplayMessage,
  fromDisplayMessage,
} from "../message-converters";
import { InternalMessage, MessageStatus } from "../../types/message";
import { DisplayMessage } from "../../stores/types";

describe("Message Converters", () => {
  describe("fromApiMessage", () => {
    it("should convert user message from API", () => {
      const apiMessage = {
        messageId: "user-1",
        timestamp: BigInt(1000),
        payload: {
          messageType: {
            case: "user" as const,
            value: {
              content: "Hello",
              selectedText: "selected",
              surrounding: "context",
            },
          },
        },
      };

      const result = fromApiMessage(apiMessage as any);

      expect(result).not.toBeNull();
      expect(result!.id).toBe("user-1");
      expect(result!.role).toBe("user");
      expect(result!.status).toBe("complete");
      if (result!.role === "user") {
        expect(result!.data.content).toBe("Hello");
        expect(result!.data.selectedText).toBe("selected");
        expect(result!.data.surrounding).toBe("context");
      }
    });

    it("should convert assistant message from API", () => {
      const apiMessage = {
        messageId: "assistant-1",
        timestamp: BigInt(2000),
        payload: {
          messageType: {
            case: "assistant" as const,
            value: {
              content: "Response",
              reasoning: "Thinking...",
              modelSlug: "gpt-4",
            },
          },
        },
      };

      const result = fromApiMessage(apiMessage as any);

      expect(result).not.toBeNull();
      expect(result!.id).toBe("assistant-1");
      expect(result!.role).toBe("assistant");
      if (result!.role === "assistant") {
        expect(result!.data.content).toBe("Response");
        expect(result!.data.reasoning).toBe("Thinking...");
        expect(result!.data.modelSlug).toBe("gpt-4");
      }
    });

    it("should convert toolCall message from API", () => {
      const apiMessage = {
        messageId: "tool-1",
        payload: {
          messageType: {
            case: "toolCall" as const,
            value: {
              name: "search",
              args: '{"query": "test"}',
              result: "Found 3 results",
              error: "",
            },
          },
        },
      };

      const result = fromApiMessage(apiMessage as any);

      expect(result).not.toBeNull();
      expect(result!.role).toBe("toolCall");
      if (result!.role === "toolCall") {
        expect(result!.data.name).toBe("search");
        expect(result!.data.result).toBe("Found 3 results");
      }
    });

    it("should convert toolCallPrepareArguments message from API", () => {
      const apiMessage = {
        messageId: "prep-1",
        payload: {
          messageType: {
            case: "toolCallPrepareArguments" as const,
            value: {
              name: "search",
              args: '{"query":',
            },
          },
        },
      };

      const result = fromApiMessage(apiMessage as any);

      expect(result).not.toBeNull();
      expect(result!.role).toBe("toolCallPrepare");
    });

    it("should convert system message from API", () => {
      const apiMessage = {
        messageId: "sys-1",
        payload: {
          messageType: {
            case: "system" as const,
            value: {
              content: "System message",
            },
          },
        },
      };

      const result = fromApiMessage(apiMessage as any);

      expect(result).not.toBeNull();
      expect(result!.role).toBe("system");
    });

    it("should convert unknown message from API", () => {
      const apiMessage = {
        messageId: "unknown-1",
        payload: {
          messageType: {
            case: "unknown" as const,
            value: {
              description: "Unknown message type",
            },
          },
        },
      };

      const result = fromApiMessage(apiMessage as any);

      expect(result).not.toBeNull();
      expect(result!.role).toBe("unknown");
    });

    it("should return null for messages without payload", () => {
      const apiMessage = { messageId: "empty-1" };
      const result = fromApiMessage(apiMessage as any);
      expect(result).toBeNull();
    });

    it("should respect status override", () => {
      const apiMessage = {
        messageId: "user-1",
        payload: {
          messageType: {
            case: "user" as const,
            value: { content: "Hello" },
          },
        },
      };

      const result = fromApiMessage(apiMessage as any, "streaming");
      expect(result!.status).toBe("streaming");
    });
  });

  describe("toApiMessage", () => {
    it("should convert user InternalMessage to API", () => {
      const internal: InternalMessage = {
        id: "user-1",
        role: "user",
        status: "complete",
        data: {
          content: "Hello",
          selectedText: "selected",
        },
      };

      const result = toApiMessage(internal);

      expect(result).toBeDefined();
      expect(result!.messageId).toBe("user-1");
    });

    it("should convert assistant InternalMessage to API", () => {
      const internal: InternalMessage = {
        id: "assistant-1",
        role: "assistant",
        status: "complete",
        data: {
          content: "Response",
          reasoning: "Thinking",
          modelSlug: "gpt-4",
        },
      };

      const result = toApiMessage(internal);

      expect(result).toBeDefined();
      expect(result!.messageId).toBe("assistant-1");
    });

    it("should convert toolCall InternalMessage to API", () => {
      const internal: InternalMessage = {
        id: "tool-1",
        role: "toolCall",
        status: "complete",
        data: {
          name: "search",
          args: "{}",
          result: "Found",
          error: "",
        },
      };

      const result = toApiMessage(internal);

      expect(result).toBeDefined();
      expect(result!.messageId).toBe("tool-1");
    });

    it("should handle optional fields in assistant message", () => {
      const internal: InternalMessage = {
        id: "assistant-1",
        role: "assistant",
        status: "complete",
        data: {
          content: "Response",
          // No reasoning or modelSlug
        },
      };

      const result = toApiMessage(internal);

      expect(result).toBeDefined();
    });
  });

  describe("fromStreamPartBegin", () => {
    it("should create assistant message from StreamPartBegin", () => {
      const partBegin = {
        messageId: "msg-1",
        payload: {
          messageType: {
            case: "assistant" as const,
            value: {
              content: "Hello",
              reasoning: "Thinking",
              modelSlug: "gpt-4",
            },
          },
        },
      };

      const result = fromStreamPartBegin(partBegin as any);

      expect(result).not.toBeNull();
      expect(result!.id).toBe("msg-1");
      expect(result!.role).toBe("assistant");
      expect(result!.status).toBe("streaming");
    });

    it("should create toolCall message from StreamPartBegin", () => {
      const partBegin = {
        messageId: "tool-1",
        payload: {
          messageType: {
            case: "toolCall" as const,
            value: {
              name: "search",
              args: "{}",
              result: "",
              error: "",
            },
          },
        },
      };

      const result = fromStreamPartBegin(partBegin as any);

      expect(result).not.toBeNull();
      expect(result!.role).toBe("toolCall");
    });

    it("should return null for user messages", () => {
      const partBegin = {
        messageId: "user-1",
        payload: {
          messageType: {
            case: "user" as const,
            value: { content: "Hello" },
          },
        },
      };

      const result = fromStreamPartBegin(partBegin as any);
      expect(result).toBeNull();
    });

    it("should return null for system messages", () => {
      const partBegin = {
        messageId: "sys-1",
        payload: {
          messageType: {
            case: "system" as const,
            value: { content: "System" },
          },
        },
      };

      const result = fromStreamPartBegin(partBegin as any);
      expect(result).toBeNull();
    });

    it("should return null when payload is missing", () => {
      const partBegin = { messageId: "msg-1" };
      const result = fromStreamPartBegin(partBegin as any);
      expect(result).toBeNull();
    });
  });

  describe("applyStreamPartEnd", () => {
    it("should update assistant message from StreamPartEnd", () => {
      const existing: InternalMessage = {
        id: "msg-1",
        role: "assistant",
        status: "streaming",
        data: { content: "Hello" },
      };

      const partEnd = {
        messageId: "msg-1",
        payload: {
          messageType: {
            case: "assistant" as const,
            value: {
              content: "Hello World!",
              reasoning: "Done",
              modelSlug: "gpt-4",
            },
          },
        },
      };

      const result = applyStreamPartEnd(partEnd as any, existing);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("complete");
      if (result!.role === "assistant") {
        expect(result!.data.content).toBe("Hello World!");
        expect(result!.data.reasoning).toBe("Done");
      }
    });

    it("should update toolCall message from StreamPartEnd", () => {
      const existing: InternalMessage = {
        id: "tool-1",
        role: "toolCall",
        status: "streaming",
        data: { name: "search", args: "{}", result: "", error: "" },
      };

      const partEnd = {
        messageId: "tool-1",
        payload: {
          messageType: {
            case: "toolCall" as const,
            value: {
              name: "search",
              args: '{"q": "test"}',
              result: "Found!",
              error: "",
            },
          },
        },
      };

      const result = applyStreamPartEnd(partEnd as any, existing);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("complete");
      if (result!.role === "toolCall") {
        expect(result!.data.result).toBe("Found!");
      }
    });

    it("should return null for role mismatch", () => {
      const existing: InternalMessage = {
        id: "msg-1",
        role: "user",
        status: "streaming",
        data: { content: "Hello" },
      };

      const partEnd = {
        messageId: "msg-1",
        payload: {
          messageType: {
            case: "assistant" as const,
            value: { content: "Response" },
          },
        },
      };

      const result = applyStreamPartEnd(partEnd as any, existing);
      expect(result).toBeNull();
    });
  });

  describe("toDisplayMessage", () => {
    it("should convert user message to DisplayMessage", () => {
      const internal: InternalMessage = {
        id: "user-1",
        role: "user",
        status: "complete",
        data: {
          content: "Hello",
          selectedText: "selected",
        },
      };

      const result = toDisplayMessage(internal);

      expect(result).not.toBeNull();
      expect(result!.id).toBe("user-1");
      expect(result!.type).toBe("user");
      expect(result!.content).toBe("Hello");
      expect(result!.selectedText).toBe("selected");
    });

    it("should convert assistant message to DisplayMessage", () => {
      const internal: InternalMessage = {
        id: "assistant-1",
        role: "assistant",
        status: "streaming",
        data: {
          content: "Response",
          reasoning: "Thinking",
        },
      };

      const result = toDisplayMessage(internal);

      expect(result).not.toBeNull();
      expect(result!.type).toBe("assistant");
      expect(result!.status).toBe("streaming");
      expect(result!.reasoning).toBe("Thinking");
    });

    it("should convert toolCall message to DisplayMessage", () => {
      const internal: InternalMessage = {
        id: "tool-1",
        role: "toolCall",
        status: "complete",
        data: {
          name: "search",
          args: '{"q": "test"}',
          result: "Found!",
          error: "",
        },
      };

      const result = toDisplayMessage(internal);

      expect(result).not.toBeNull();
      expect(result!.type).toBe("toolCall");
      expect(result!.toolName).toBe("search");
      expect(result!.toolResult).toBe("Found!");
    });

    it("should return null for system messages", () => {
      const internal: InternalMessage = {
        id: "sys-1",
        role: "system",
        status: "complete",
        data: { content: "System" },
      };

      const result = toDisplayMessage(internal);
      expect(result).toBeNull();
    });

    it("should return null for unknown messages", () => {
      const internal: InternalMessage = {
        id: "unknown-1",
        role: "unknown",
        status: "complete",
        data: { description: "Unknown" },
      };

      const result = toDisplayMessage(internal);
      expect(result).toBeNull();
    });
  });

  describe("fromDisplayMessage", () => {
    it("should convert user DisplayMessage to InternalMessage", () => {
      const display: DisplayMessage = {
        id: "user-1",
        type: "user",
        status: "complete",
        content: "Hello",
        selectedText: "selected",
      };

      const result = fromDisplayMessage(display);

      expect(result.id).toBe("user-1");
      expect(result.role).toBe("user");
      if (result.role === "user") {
        expect(result.data.content).toBe("Hello");
        expect(result.data.selectedText).toBe("selected");
      }
    });

    it("should convert assistant DisplayMessage to InternalMessage", () => {
      const display: DisplayMessage = {
        id: "assistant-1",
        type: "assistant",
        status: "streaming",
        content: "Response",
        reasoning: "Thinking",
      };

      const result = fromDisplayMessage(display);

      expect(result.role).toBe("assistant");
      expect(result.status).toBe("streaming");
      if (result.role === "assistant") {
        expect(result.data.reasoning).toBe("Thinking");
      }
    });

    it("should convert toolCall DisplayMessage to InternalMessage", () => {
      const display: DisplayMessage = {
        id: "tool-1",
        type: "toolCall",
        status: "complete",
        content: "",
        toolName: "search",
        toolArgs: "{}",
        toolResult: "Found!",
      };

      const result = fromDisplayMessage(display);

      expect(result.role).toBe("toolCall");
      if (result.role === "toolCall") {
        expect(result.data.name).toBe("search");
        expect(result.data.result).toBe("Found!");
      }
    });

    it("should convert error DisplayMessage to unknown InternalMessage", () => {
      const display: DisplayMessage = {
        id: "error-1",
        type: "error",
        status: "error",
        content: "Something went wrong",
      };

      const result = fromDisplayMessage(display);

      expect(result.role).toBe("unknown");
      if (result.role === "unknown") {
        expect(result.data.description).toBe("Something went wrong");
      }
    });
  });

  describe("Round-trip conversion", () => {
    it("should maintain data integrity through InternalMessage → DisplayMessage → InternalMessage", () => {
      const original: InternalMessage = {
        id: "assistant-1",
        role: "assistant",
        status: "complete",
        data: {
          content: "Hello World",
          reasoning: "Deep thought",
          modelSlug: "gpt-4",
        },
      };

      const display = toDisplayMessage(original);
      expect(display).not.toBeNull();

      const restored = fromDisplayMessage(display!);

      expect(restored.id).toBe(original.id);
      expect(restored.role).toBe(original.role);
      expect(restored.status).toBe(original.status);
      if (restored.role === "assistant") {
        expect(restored.data.content).toBe(original.data.content);
        expect(restored.data.reasoning).toBe(original.data.reasoning);
      }
    });
  });
});
