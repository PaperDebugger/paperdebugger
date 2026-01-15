/**
 * Test file to verify that the protobuf-utils wrapper handles unknown fields gracefully.
 */

import { describe, it, expect } from "bun:test";
import { fromJson } from "./protobuf-utils";
import { MessageSchema } from "../pkg/gen/apiclient/chat/v2/chat_pb";

describe("protobuf-utils", () => {
  describe("fromJson", () => {
    it("should ignore unknown fields from newer backend versions", () => {
      // Simulate JSON response from backend with an extra field "newFieldThatDoesntExistYet"
      const jsonWithUnknownField = {
        messageId: "test-123",
        payload: {
          user: {
            content: "Hello",
            selectedText: "",
            newFieldThatDoesntExistYet: "This is a new field from a newer backend version",
          },
        },
        timestamp: "0",
      };

      // This should NOT throw an error even though "newFieldThatDoesntExistYet" doesn't exist in the schema
      const message = fromJson(MessageSchema, jsonWithUnknownField);

      expect(message.messageId).toBe("test-123");
      expect(message.payload?.messageType.case).toBe("user");
      if (message.payload?.messageType.case === "user") {
        expect(message.payload.messageType.value.content).toBe("Hello");
      }
    });

    it("should handle missing optional fields gracefully", () => {
      // Missing optional fields should not cause errors
      const minimalJson = {
        messageId: "minimal-test",
        timestamp: "0",
      };

      const message = fromJson(MessageSchema, minimalJson);

      expect(message.messageId).toBe("minimal-test");
      expect(message.payload).toBeUndefined();
    });

    it("should use empty string for missing messageId", () => {
      // Missing messageId field (proto3 defaults to empty string)
      const jsonWithoutMessageId = {
        payload: {
          user: {
            content: "Hello",
          },
        },
      };

      const message = fromJson(MessageSchema, jsonWithoutMessageId);

      // Proto3 defaults string fields to empty string
      expect(message.messageId).toBe("");
    });
  });
});
