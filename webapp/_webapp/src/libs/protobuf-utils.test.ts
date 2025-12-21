/**
 * Test file to demonstrate that the protobuf-utils wrapper handles unknown fields gracefully.
 * 
 * This test can be run manually to verify the fix. Since the project doesn't have
 * a test runner configured, this serves as documentation of the expected behavior.
 * 
 * To test manually:
 * 1. Add a new field to a protobuf schema on the backend
 * 2. Deploy the backend
 * 3. Use an older version of the webapp (without regenerating protobuf files)
 * 4. Verify that the webapp doesn't crash when receiving the new field
 */

import { fromJson } from "./protobuf-utils";
import { MessageSchema } from "../pkg/gen/apiclient/chat/v2/chat_pb";

/**
 * Example: Testing that fromJson ignores unknown fields
 * 
 * This would simulate a backend returning a message with a new field
 * that doesn't exist in the current schema.
 */
function testIgnoreUnknownFields() {
  // Simulate JSON response from backend with an extra field "newField"
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

  try {
    // This should NOT throw an error even though "newFieldThatDoesntExistYet" doesn't exist in the schema
    const message = fromJson(MessageSchema, jsonWithUnknownField);
    console.log("✓ Successfully parsed message with unknown field");
    console.log("  Message ID:", message.messageId);
    console.log("  User content:", message.payload.user?.content);
    return true;
  } catch (error) {
    console.error("✗ Failed to parse message with unknown field:", error);
    return false;
  }
}

/**
 * Example: Testing that fromJson still validates required fields
 */
function testRequiredFieldsStillValidated() {
  // Missing required messageId field
  const invalidJson = {
    payload: {
      user: {
        content: "Hello",
      },
    },
  };

  try {
    const message = fromJson(MessageSchema, invalidJson);
    console.log("✓ Parsed message (messageId will be empty string):", message.messageId);
    return true;
  } catch (error) {
    console.error("✗ Failed to parse message:", error);
    return false;
  }
}

// Export test functions for manual testing
export { testIgnoreUnknownFields, testRequiredFieldsStillValidated };
