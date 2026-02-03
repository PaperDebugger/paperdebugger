/**
 * Utils Module
 *
 * Re-exports all utility functions.
 */

// Message Converters
export {
  // API ↔ InternalMessage
  fromApiMessage,
  toApiMessage,
  // Stream Events → InternalMessage
  fromStreamPartBegin,
  applyStreamPartEnd,
  // InternalMessage ↔ DisplayMessage
  toDisplayMessage,
  fromDisplayMessage,
} from "./message-converters";

// Stream Request Builder
export { buildStreamRequest, validateStreamRequestParams, type StreamRequestParams } from "./stream-request-builder";

// Stream Event Mapper
export {
  mapResponseToStreamEvent,
  isFinalizeEvent,
  isErrorEvent,
  isInitEvent,
  isChunkEvent,
} from "./stream-event-mapper";
