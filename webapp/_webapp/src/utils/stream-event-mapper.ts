/**
 * Stream Event Mapper
 *
 * Maps API streaming responses to typed StreamEvent objects for the state machine.
 * This extracts the mapping logic from useSendMessageStream hook,
 * providing a pure, testable function.
 */

import {
  CreateConversationMessageStreamResponse,
  IncompleteIndicator,
  MessageChunk,
  ReasoningChunk,
  StreamError,
  StreamFinalization,
  StreamInitialization,
  StreamPartBegin,
  StreamPartEnd,
} from "../pkg/gen/apiclient/chat/v2/chat_pb";
import { StreamEvent } from "../stores/streaming";
import { logError } from "../libs/logger";

// ============================================================================
// Event Mapper
// ============================================================================

/**
 * Maps the API response payload to a StreamEvent for the state machine.
 *
 * This is a pure function that converts the API response to a typed event
 * that can be handled by the streaming state machine.
 *
 * @param response - The streaming response from the API
 * @returns A StreamEvent or null if the response type is not recognized
 *
 * @example
 * ```ts
 * createConversationMessageStream(request, (response) => {
 *   const event = mapResponseToStreamEvent(response);
 *   if (event) {
 *     machine.handleEvent(event);
 *   }
 * });
 * ```
 */
export function mapResponseToStreamEvent(
  response: CreateConversationMessageStreamResponse
): StreamEvent | null {
  const { case: payloadCase, value } = response.responsePayload;

  switch (payloadCase) {
    case "streamInitialization":
      return { type: "INIT", payload: value as StreamInitialization };

    case "streamPartBegin":
      return { type: "PART_BEGIN", payload: value as StreamPartBegin };

    case "messageChunk":
      return { type: "CHUNK", payload: value as MessageChunk };

    case "reasoningChunk":
      return { type: "REASONING_CHUNK", payload: value as ReasoningChunk };

    case "streamPartEnd":
      return { type: "PART_END", payload: value as StreamPartEnd };

    case "streamFinalization":
      return { type: "FINALIZE", payload: value as StreamFinalization };

    case "streamError":
      return { type: "ERROR", payload: value as StreamError };

    case "incompleteIndicator":
      return { type: "INCOMPLETE", payload: value as IncompleteIndicator };

    default:
      // Log unexpected payload types for debugging
      if (value !== undefined) {
        logError("Unexpected response payload type:", payloadCase, response.responsePayload);
      }
      return null;
  }
}

// ============================================================================
// Event Type Guards
// ============================================================================

/**
 * Check if an event is a finalization event.
 */
export function isFinalizeEvent(event: StreamEvent): event is { type: "FINALIZE"; payload: StreamFinalization } {
  return event.type === "FINALIZE";
}

/**
 * Check if an event is an error event.
 */
export function isErrorEvent(event: StreamEvent): event is { type: "ERROR"; payload: StreamError } {
  return event.type === "ERROR";
}

/**
 * Check if an event is an initialization event.
 */
export function isInitEvent(event: StreamEvent): event is { type: "INIT"; payload: StreamInitialization } {
  return event.type === "INIT";
}

/**
 * Check if an event is a content chunk event.
 */
export function isChunkEvent(event: StreamEvent): event is { type: "CHUNK"; payload: MessageChunk } {
  return event.type === "CHUNK";
}
