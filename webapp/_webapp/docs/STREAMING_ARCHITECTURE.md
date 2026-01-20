# Streaming Architecture Documentation

This document describes the refactored streaming architecture for the PaperDebugger chat system.

## Overview

The streaming system handles real-time message delivery from the server to the client, managing state transitions, error recovery, and UI updates. The architecture has been redesigned to be more maintainable, testable, and extensible.

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         useSendMessageStream Hook                          │
│                    (Orchestrator - Single Responsibility)                  │
│  - Builds stream requests using buildStreamRequest()                       │
│  - Maps responses using mapResponseToStreamEvent()                         │
│  - Delegates event handling to state machine                               │
└─────────────────────────────────┬──────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                       StreamingStateMachine                                 │
│                    (Zustand Store + Event Handler)                         │
│  State: idle | receiving | finalizing | error                              │
│  Actions: handleEvent(), reset()                                           │
│  Data: streamingMessage, incompleteIndicator                               │
└─────────────────────────────────┬──────────────────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│ MessageType     │    │ Error            │    │ Conversation        │
│ Handlers        │    │ Handler          │    │ Store               │
│ (Registry)      │    │ (Recovery)       │    │ (Persistence)       │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
         │                        │                        │
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          MessageStore                                       │
│                    (Unified Display Messages)                              │
│  - Subscribes to ConversationStore (finalized messages)                    │
│  - Subscribes to StreamingStateMachine (streaming messages)                │
│  - Provides getAllDisplayMessages() for UI components                      │
└─────────────────────────────────┬──────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           UI Components                                     │
│              (ChatBody, MessageCard, etc.)                                 │
│  - Consume DisplayMessage type directly                                    │
│  - No knowledge of streaming internals                                     │
└────────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. StreamingStateMachine (`stores/streaming/streaming-state-machine.ts`)

The central hub for all streaming state management. Implements a state machine pattern with the following states:

| State | Description | Valid Transitions |
|-------|-------------|-------------------|
| `idle` | No active stream | → `receiving` (on INIT) |
| `receiving` | Actively receiving stream data | → `finalizing`, `error` |
| `finalizing` | Flushing data to conversation store | → `idle` |
| `error` | Error occurred during streaming | → `idle` (on reset) |

#### Event Types

```typescript
type StreamEvent =
  | { type: "INIT"; payload: StreamInitialization }
  | { type: "PART_BEGIN"; payload: StreamPartBegin }
  | { type: "CHUNK"; payload: MessageChunk }
  | { type: "REASONING_CHUNK"; payload: ReasoningChunk }
  | { type: "PART_END"; payload: StreamPartEnd }
  | { type: "FINALIZE"; payload: StreamFinalization }
  | { type: "ERROR"; payload: StreamError }
  | { type: "INCOMPLETE"; payload: IncompleteIndicator }
  | { type: "CONNECTION_ERROR"; payload: Error };
```

### 2. MessageTypeHandlers (`stores/streaming/message-type-handlers.ts`)

A registry of handlers for different message types. Adding a new message type only requires:
1. Creating a new handler class implementing `MessageTypeHandler`
2. Registering it in the `messageTypeHandlers` registry

Available handlers:
- `AssistantHandler` - Handles assistant messages
- `ToolCallPrepareHandler` - Handles tool call argument streaming
- `ToolCallHandler` - Handles completed tool calls
- `NoOpHandler` - For types that don't require streaming handling

### 3. ErrorHandler (`stores/streaming/error-handler.ts`)

Centralized error handling with configurable recovery strategies:

| Error Code | Strategy | Behavior |
|------------|----------|----------|
| `PROJECT_OUT_OF_DATE` | sync-and-retry | Sync project, then retry |
| `NETWORK_ERROR` | retry | Exponential backoff, 3 attempts |
| `TIMEOUT` | retry | Linear backoff, 2 attempts |
| `RATE_LIMITED` | retry | Exponential backoff, 3 attempts |
| `SERVER_ERROR` | retry | Exponential backoff, 2 attempts |
| `INVALID_RESPONSE` | show-error | Display error toast |
| `AUTHENTICATION_ERROR` | show-error | Display error, require re-auth |
| `UNKNOWN` | show-error | Display generic error |

### 4. MessageStore (`stores/message-store.ts`)

Unified store that combines finalized and streaming messages:

```typescript
interface MessageStore {
  // State
  messages: Message[];           // Finalized from API
  streamingEntries: InternalMessage[];  // Currently streaming
  
  // Computed
  getAllDisplayMessages(): DisplayMessage[];
  getVisibleDisplayMessages(): DisplayMessage[];
  
  // Helpers
  hasStreamingMessages(): boolean;
  isWaitingForResponse(): boolean;
}
```

## Data Types

### InternalMessage

The canonical internal message format used throughout the application:

```typescript
type InternalMessage =
  | UserMessage
  | AssistantMessage
  | ToolCallMessage
  | ToolCallPrepareMessage
  | SystemMessage
  | UnknownMessage;

interface UserMessage {
  id: string;
  role: "user";
  status: MessageStatus;
  data: {
    content: string;
    selectedText?: string;
    surrounding?: string;
  };
}

// Similar structures for other message types...
```

### DisplayMessage

UI-friendly message format:

```typescript
interface DisplayMessage {
  id: string;
  type: "user" | "assistant" | "toolCall" | "toolCallPrepare" | "error";
  status: "streaming" | "complete" | "error" | "stale";
  content: string;
  // Role-specific optional fields
  selectedText?: string;
  reasoning?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: string;
  toolError?: string;
}
```

## Data Flow

### Happy Path: User Message → Response

```
1. User submits message
   └── useSendMessageStream.sendMessageStream(message, selectedText)
       └── buildStreamRequest() → API request

2. User message added to streaming state
   └── StreamingStateMachine.setState({ streamingMessage: { parts: [userMessage] } })

3. API stream begins
   └── Server sends: streamInitialization
       └── INIT event → Finalize user message, flush to conversation

4. Assistant response streams
   └── Server sends: streamPartBegin (assistant)
       └── PART_BEGIN event → Create streaming assistant message
   └── Server sends: messageChunk (delta: "Hello")
       └── CHUNK event → Append to assistant content
   └── Server sends: messageChunk (delta: " World")
       └── CHUNK event → Append to assistant content
   └── Server sends: streamPartEnd (assistant)
       └── PART_END event → Mark as complete

5. Stream completes
   └── Server sends: streamFinalization
       └── FINALIZE event → Flush to conversation, reset streaming state
```

### Error Recovery Flow

```
1. Error occurs during streaming
   └── Server sends: streamError or connection fails
       └── ERROR/CONNECTION_ERROR event

2. ErrorHandler evaluates strategy
   └── createStreamingError() → Categorize error
   └── getRecoveryStrategy() → Determine recovery approach

3. Execute recovery
   └── retry: Attempt operation again with backoff
   └── sync-and-retry: Sync project first, then retry
   └── show-error: Display toast to user
   └── abort: Stop processing
```

## File Structure

```
src/
├── stores/
│   ├── streaming/
│   │   ├── index.ts                    # Module exports
│   │   ├── types.ts                    # Type definitions
│   │   ├── streaming-state-machine.ts  # Main state machine
│   │   ├── message-type-handlers.ts    # Handler registry
│   │   ├── error-handler.ts            # Error handling
│   │   └── __tests__/                  # Unit tests
│   │       ├── streaming-state-machine.test.ts
│   │       ├── message-type-handlers.test.ts
│   │       └── error-handler.test.ts
│   ├── message-store.ts                # Unified message store
│   ├── converters.ts                   # Store-level converters
│   └── types.ts                        # Store types (DisplayMessage)
├── types/
│   └── message.ts                      # InternalMessage definitions
├── utils/
│   ├── message-converters.ts           # API ↔ Internal converters
│   ├── stream-request-builder.ts       # Request building
│   ├── stream-event-mapper.ts          # Response → Event mapping
│   └── __tests__/
│       └── message-converters.test.ts
├── hooks/
│   └── useSendMessageStream.ts         # Main orchestration hook
└── __tests__/
    └── streaming-flow.integration.test.ts
```

## Extension Points

### Adding a New Message Type

1. Define the type in `types/message.ts`:
```typescript
export interface NewMessageData {
  // type-specific data
}

export interface NewMessage extends InternalMessageBase {
  role: "newType";
  data: NewMessageData;
}

// Update InternalMessage union
export type InternalMessage = ... | NewMessage;
```

2. Create handler in `message-type-handlers.ts`:
```typescript
class NewTypeHandler implements MessageTypeHandler {
  onPartBegin(partBegin: StreamPartBegin): InternalMessage | null {
    // Create streaming message
  }
  
  onPartEnd(partEnd: StreamPartEnd, existing: InternalMessage): InternalMessage | null {
    // Finalize message
  }
}

// Register in messageTypeHandlers
```

3. Add converters in `utils/message-converters.ts`:
```typescript
// In fromApiMessage()
case "newType":
  return { /* conversion */ };

// In toApiMessage()  
case "newType":
  return fromJson(MessageSchema, { /* conversion */ });
```

### Adding a New Error Type

1. Add error code in `stores/streaming/types.ts`:
```typescript
export type StreamingErrorCode = 
  | ... 
  | "NEW_ERROR_TYPE";
```

2. Add detection in `error-handler.ts`:
```typescript
function detectErrorCodeFromMessage(message: string): StreamingErrorCode {
  if (message.includes("new error pattern")) {
    return "NEW_ERROR_TYPE";
  }
  // ...
}
```

3. Configure recovery strategy:
```typescript
const DEFAULT_STRATEGIES: Record<StreamingErrorCode, RecoveryStrategy> = {
  NEW_ERROR_TYPE: {
    type: "retry",
    maxRetries: 2,
    backoff: "exponential",
    delayMs: 1000,
  },
  // ...
};
```

## Testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/stores/streaming/__tests__/streaming-state-machine.test.ts

# Run with watch mode
bun test --watch
```

### Test Coverage

- **Unit Tests**: State machine, handlers, error handler, converters
- **Integration Tests**: Complete streaming flows, error scenarios

## Performance Considerations

1. **Sequence Numbers**: Each update increments a sequence number, allowing React to detect changes efficiently.

2. **Computed Selectors**: `getAllDisplayMessages()` is computed and cached, only recomputing when source data changes.

3. **Subscription-based Updates**: MessageStore subscribes to source stores, avoiding polling.

4. **No flushSync**: The architecture uses natural React batching, eliminating the need for `flushSync`.

## Troubleshooting

### Messages not appearing

1. Check that the state machine is receiving events (add logging to `handleEvent`)
2. Verify MessageStore subscriptions are initialized
3. Check DisplayMessage conversion in `toDisplayMessage()`

### Stale messages after error

1. Verify error event is being dispatched
2. Check that the error handler is marking messages as stale
3. Ensure UI is properly rendering stale status

### Retry not working

1. Check error code detection in `createStreamingError()`
2. Verify recovery strategy is configured for the error type
3. Ensure sync/retry callbacks are provided to error handler
