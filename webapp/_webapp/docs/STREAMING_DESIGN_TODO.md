# TODO: Streaming Message Design Improvements

This document outlines a phased approach to simplify and improve the front-end streaming architecture.

---

## Phase 1: Consolidate Handlers into State Machine ✅ COMPLETED

### Goal
Replace 9 separate handler files with a single, cohesive state machine that manages all streaming state transitions.

### Tasks

- [x] **1.1 Create StreamingStateMachine class**
  - Location: `stores/streaming/streaming-state-machine.ts`
  - Implemented as a Zustand store with `handleEvent` method for centralized event handling
  - Benefit: Single point of control for all state transitions

- [x] **1.2 Define StreamEvent union type**
  - Location: `stores/streaming/types.ts`
  - Includes all event types: INIT, PART_BEGIN, CHUNK, REASONING_CHUNK, PART_END, FINALIZE, ERROR, INCOMPLETE, CONNECTION_ERROR
  - Benefit: Type-safe event handling with exhaustive checking

- [x] **1.3 Create message type handlers registry**
  - Location: `stores/streaming/message-type-handlers.ts`
  - Implemented handlers: AssistantHandler, ToolCallHandler, ToolCallPrepareHandler, NoOpHandler
  - Benefit: Add new message types without modifying multiple files

- [x] **1.4 Delete old handler files**
  - Deleted files:
    - `handlers/handleStreamInitialization.ts`
    - `handlers/handleStreamPartBegin.ts`
    - `handlers/handleMessageChunk.ts`
    - `handlers/handleReasoningChunk.ts`
    - `handlers/handleStreamPartEnd.ts`
    - `handlers/handleStreamFinalization.ts`
    - `handlers/handleStreamError.ts`
    - `handlers/handleIncompleteIndicator.ts`
    - `handlers/handleError.ts`
    - `handlers/converter.ts`

### New File Structure

```
stores/streaming/
├── index.ts                      # Module exports
├── types.ts                      # StreamEvent, MessageEntry, etc.
├── message-type-handlers.ts      # Handler registry
└── streaming-state-machine.ts    # Main state machine (Zustand store)
```

### Migration Notes

- `streaming-message-store.ts` now serves as a backward compatibility layer
- `conversation/types.ts` re-exports types from the streaming module
- All consumer components updated to use `useStreamingStateMachine`

---

## Phase 2: Unify Store Architecture ✅ COMPLETED

### Goal
Consolidate `streaming-message-store` and `conversation-store` message handling into a single coherent store.

### Tasks

- [x] **2.1 Create unified message store**
  - Location: `stores/message-store.ts`
  - Implemented with automatic subscriptions to `conversation-store` and `streaming-state-machine`
  - Provides `getAllDisplayMessages()` and `getVisibleDisplayMessages()` selectors
  - Auto-initializes subscriptions on module import
  - Benefit: Single source of truth with clear streaming vs finalized separation

- [x] **2.2 Create DisplayMessage type**
  - Location: `stores/types.ts`
  - Implemented with types: `user`, `assistant`, `toolCall`, `toolCallPrepare`, `error`
  - Status types: `streaming`, `complete`, `error`, `stale`
  - Includes support for reasoning, tool args/results, and selected text
  - Benefit: UI components work with one consistent type

- [x] **2.3 Remove flushSync calls**
  - No `flushSync` calls exist in the codebase
  - Update flow uses Zustand's `subscribeWithSelector` middleware for reactive subscriptions
  - `conversation-store` and `streaming-state-machine` now both use `subscribeWithSelector`
  - `message-store` subscribes to both stores and updates automatically

- [x] **2.4 Migrate ChatBody to use unified store**
  - ChatBody now uses:
    ```typescript
    const allDisplayMessages = useMessageStore((s) => s.getAllDisplayMessages());
    ```
  - Helper functions updated to use unified store (e.g., `isEmptyConversation`)
  - Converters in `stores/converters.ts` provide bidirectional conversion

### Architecture Notes

The unified message store architecture:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           useMessageStore                                   │
│  - messages: Message[] (finalized)                                         │
│  - streamingEntries: InternalMessage[] (streaming)                         │
│  - getAllDisplayMessages(): DisplayMessage[]                               │
└─────────────────────────────┬───────────────────────────────┬──────────────┘
                              │                               │
            ┌─────────────────┴─────────────┐   ┌─────────────┴─────────────┐
            │      subscribes to            │   │      subscribes to        │
            ▼                               │   ▼                           │
┌───────────────────────────────┐           │  ┌───────────────────────────┐
│    useConversationStore       │           │  │ useStreamingStateMachine  │
│  - currentConversation        │           │  │ - streamingMessage        │
│  (finalized messages)         │           │  │ (streaming InternalMessage) │
└───────────────────────────────┘           │  └───────────────────────────┘
                                            │
                                            ▼
                              ┌─────────────────────────────────┐
                              │        ChatBody Component       │
                              │  Uses useMessageStore directly  │
                              └─────────────────────────────────┘
```

---

## Phase 3: Simplify Data Transformations ✅ COMPLETED

### Goal
Reduce the number of data transformations from 5+ to 2 maximum.

### Tasks

- [x] **3.1 Define canonical internal message format**
  - Location: `types/message.ts`
  - Implemented `InternalMessage` union type with role-specific subtypes:
    - `UserMessage`, `AssistantMessage`, `ToolCallMessage`, `ToolCallPrepareMessage`, `SystemMessage`, `UnknownMessage`
  - Added type guards: `isUserMessage()`, `isAssistantMessage()`, etc.
  - Added factory functions: `createUserMessage()`, `createAssistantMessage()`, etc.
  - Benefit: Single format with type-safe role-specific data access

- [x] **3.2 Create bidirectional converters**
  - Location: `utils/message-converters.ts`
  - Implemented converters:
    - `fromApiMessage()` - API Message → InternalMessage
    - `toApiMessage()` - InternalMessage → API Message
    - `fromStreamPartBegin()` - Stream event → InternalMessage
    - `applyStreamPartEnd()` - Update InternalMessage from stream end event
    - `toDisplayMessage()` / `fromDisplayMessage()` - InternalMessage ↔ DisplayMessage
  - Benefit: Clear boundary between API types and internal types

- [x] **3.3 Update MessageCard to use DisplayMessage directly**
  - MessageCard now accepts `message: DisplayMessage` prop instead of `messageEntry: MessageEntry`
  - Removed `displayMessageToMessageEntry()` bridge function from helper.ts
  - ChatBody passes DisplayMessage directly to MessageCard
  - Benefit: Eliminated unnecessary data transformation at render time

- [x] **3.4 Remove legacy MessageEntry type**
  - Streaming state machine now uses `InternalMessage` directly instead of `MessageEntry`
  - Removed `MessageEntry` and `MessageEntryStatus` enum from `streaming/types.ts`
  - Updated message-store.ts to use `streamingEntries: InternalMessage[]`
  - Removed legacy converters (`fromMessageEntry`, `toMessageEntry`)
  - Updated all consumers (hooks, views, devtools) to use `InternalMessage` and `MessageStatus`

### New File Structure

```
types/
├── index.ts                      # Module exports for types
├── message.ts                    # InternalMessage type definitions
└── global.d.ts                   # (existing)

utils/
├── index.ts                      # Module exports for utilities
└── message-converters.ts         # All message converters in one place
```

### Data Flow After Phase 3

```
API Response (Message)
    │
    ▼ fromApiMessage()
InternalMessage
    │
    ▼ toDisplayMessage()
DisplayMessage ─────────────────────────► MessageCard
    ▲
    │ (streaming state uses InternalMessage directly)              
InternalMessage (streaming state)
```

### Migration Notes

- Legacy `MessageEntry` type has been removed - all code uses `InternalMessage`
- `MessageEntryStatus` enum replaced with `MessageStatus` string union: `"streaming" | "complete" | "error" | "stale"`
- `stores/converters.ts` simplified to only bridge between API types and display types
- Factory functions (`createUserMessage`, etc.) used for creating new messages

---

## Phase 4: Improve Error Handling ✅ COMPLETED

### Goal
Create a unified error handling strategy for all streaming errors.

### Tasks

- [x] **4.1 Create StreamingErrorHandler class**
  - Location: `stores/streaming/error-handler.ts`
  - Implemented `StreamingErrorHandler` class with:
    - `handle()` method for centralized error handling
    - Support for multiple recovery strategies
    - Exponential and linear backoff for retries
    - Automatic error categorization from error messages and codes
  - Benefit: Centralized error handling logic

- [x] **4.2 Define error recovery strategies**
  - Location: `stores/streaming/types.ts`
  - Implemented `RecoveryStrategy` union type with:
    - `retry` - Retry with configurable attempts and backoff
    - `sync-and-retry` - Sync project then retry (for PROJECT_OUT_OF_DATE)
    - `show-error` - Display error to user
    - `abort` - Stop processing
  - Added `StreamingError`, `ErrorContext`, `ErrorResolution` types
  - Benefit: Explicit, testable recovery strategies

- [x] **4.3 Remove duplicate retry logic**
  - Created `withStreamingErrorHandler()` as replacement for `withRetrySync()`
  - Updated `useSendMessageStream` to use new error handler
  - Updated `streaming-state-machine.ts` to use `StreamingErrorHandler`
  - Deprecated `with-retry-sync.ts` with migration guide
  - Single retry implementation with configurable strategies

### New File Structure

```
stores/streaming/
├── index.ts                      # Module exports (updated)
├── types.ts                      # Added error handling types
├── message-type-handlers.ts      # (existing)
├── streaming-state-machine.ts    # Updated to use error handler
└── error-handler.ts              # NEW: Centralized error handling
```

### Error Handling Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         StreamingErrorHandler                               │
│  - createStreamingError(): Normalize errors to StreamingError              │
│  - getRecoveryStrategy(): Get strategy based on error code                 │
│  - handle(): Execute recovery strategy                                     │
└─────────────────────────────────┬──────────────────────────────────────────┘
                                  │
    ┌─────────────────────────────┼─────────────────────────────────┐
    │                             │                                 │
    ▼                             ▼                                 ▼
┌─────────────────┐    ┌─────────────────┐           ┌─────────────────────┐
│ retry           │    │ sync-and-retry  │           │ show-error          │
│ (NETWORK,       │    │ (PROJECT_OUT_   │           │ (AUTH, INVALID,     │
│  TIMEOUT, etc.) │    │  OF_DATE)       │           │  UNKNOWN)           │
└─────────────────┘    └─────────────────┘           └─────────────────────┘
```

### Recovery Strategies Configuration

| Error Code | Strategy | Max Attempts | Backoff |
|------------|----------|--------------|---------|
| PROJECT_OUT_OF_DATE | sync-and-retry | 2 | - |
| NETWORK_ERROR | retry | 3 | exponential, 1000ms |
| TIMEOUT | retry | 2 | linear, 2000ms |
| RATE_LIMITED | retry | 3 | exponential, 5000ms |
| SERVER_ERROR | retry | 2 | exponential, 2000ms |
| INVALID_RESPONSE | show-error | - | - |
| AUTHENTICATION_ERROR | show-error | - | - |
| UNKNOWN | show-error | - | - |

### Migration Notes

- `withRetrySync()` is deprecated, use `withStreamingErrorHandler()` instead
- Error handling in `streaming-state-machine.ts` now uses `StreamingErrorHandler`
- All error types are normalized to `StreamingError` for consistent handling
- Recovery strategies are configurable per error type

---

## Phase 5: Refactor useSendMessageStream Hook ✅ COMPLETED

### Goal
Simplify the main orchestration hook by delegating to the state machine.

### Tasks

- [x] **5.1 Simplify hook to single responsibility**
  - Refactored hook to focus on orchestration
  - Delegated all event handling to the state machine
  - Added `isStreaming` state to return value for consumers
  - Extracted helper functions (`addUserMessageToStream`, `truncateConversationIfEditing`)
  - Benefit: Hook focuses on orchestration, not event handling

- [x] **5.2 Reduce hook dependencies**
  - Reduced from 12 dependencies to better organized structure
  - Used `useCallback` for helper functions to stabilize references
  - Used memoized return value with `useMemo`
  - Improved store access patterns (using selectors instead of destructuring)

- [x] **5.3 Extract request building logic**
  - Location: `utils/stream-request-builder.ts`
  - Created `buildStreamRequest()` function
  - Added `validateStreamRequestParams()` for input validation
  - Created `StreamRequestParams` interface for type safety
  - Benefit: Testable, pure function for request creation

- [x] **5.4 Extract response-to-event mapping**
  - Location: `utils/stream-event-mapper.ts`
  - Created `mapResponseToStreamEvent()` function
  - Added type guards: `isFinalizeEvent`, `isErrorEvent`, `isInitEvent`, `isChunkEvent`
  - Benefit: Pure function, easy to test and reuse

### New File Structure

```
utils/
├── index.ts                      # Updated exports
├── message-converters.ts         # (existing)
├── stream-request-builder.ts     # NEW: Request building logic
└── stream-event-mapper.ts        # NEW: Response to event mapping

hooks/
└── useSendMessageStream.ts       # REFACTORED: Simplified orchestration
```

### Architecture After Phase 5

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       useSendMessageStream Hook                             │
│  (Orchestrator - single responsibility)                                    │
└─────────────────────────────────┬──────────────────────────────────────────┘
                                  │
    ┌─────────────────────────────┼─────────────────────────────────┐
    │                             │                                 │
    ▼                             ▼                                 ▼
┌─────────────────┐    ┌─────────────────┐           ┌─────────────────────┐
│ buildStream     │    │ mapResponseTo   │           │ StreamingState      │
│ Request()       │    │ StreamEvent()   │           │ Machine             │
│ (pure function) │    │ (pure function) │           │ (event handling)    │
└─────────────────┘    └─────────────────┘           └─────────────────────┘
```

### Hook Return Type

```typescript
interface UseSendMessageStreamResult {
  /** Function to send a message as a stream */
  sendMessageStream: (message: string, selectedText: string, parentMessageId?: string) => Promise<void>;
  /** Whether a stream is currently active */
  isStreaming: boolean;
}
```

### Migration Notes

- Hook now returns `{ sendMessageStream, isStreaming }` instead of just `{ sendMessageStream }`
- No breaking changes to existing consumers (they can ignore `isStreaming` if not needed)
- Request building and event mapping are now testable pure functions
- Error handling uses `withStreamingErrorHandler` from Phase 4

---

## Phase 6: Testing & Documentation ✅ COMPLETED

### Goal
Ensure the refactored code is well-tested and documented.

### Tasks

- [x] **6.1 Add unit tests for state machine**
  - Location: `stores/streaming/__tests__/streaming-state-machine.test.ts`
  - Tests all state transitions: idle → receiving → finalizing → idle
  - Tests error handling: ERROR, CONNECTION_ERROR events
  - Tests all event types: INIT, PART_BEGIN, CHUNK, REASONING_CHUNK, PART_END, FINALIZE, INCOMPLETE
  - Tests message type handlers via state machine integration

- [x] **6.2 Add unit tests for message type handlers**
  - Location: `stores/streaming/__tests__/message-type-handlers.test.ts`
  - Tests handler registry and `getMessageTypeHandler()`
  - Tests `isValidMessageRole()` type guard
  - Tests AssistantHandler: onPartBegin, onPartEnd
  - Tests ToolCallPrepareHandler: onPartBegin, onPartEnd
  - Tests ToolCallHandler: onPartBegin, onPartEnd
  - Tests NoOpHandler for user, system, unknown roles

- [x] **6.3 Add unit tests for error handler**
  - Location: `stores/streaming/__tests__/error-handler.test.ts`
  - Tests `createStreamingError()` for all error sources
  - Tests `getRecoveryStrategy()` for all error codes
  - Tests `isRetryableError()` helper
  - Tests `StreamingErrorHandler` class with retry, sync-and-retry, show-error strategies
  - Tests `withStreamingErrorHandler()` wrapper function
  - Tests backoff calculation (exponential and linear)

- [x] **6.4 Add unit tests for message converters**
  - Location: `utils/__tests__/message-converters.test.ts`
  - Tests `fromApiMessage()` for all message types
  - Tests `toApiMessage()` for all message types
  - Tests `fromStreamPartBegin()` and `applyStreamPartEnd()`
  - Tests `toDisplayMessage()` and `fromDisplayMessage()`
  - Tests round-trip conversion integrity

- [x] **6.5 Add integration tests for streaming flow**
  - Location: `src/__tests__/streaming-flow.integration.test.ts`
  - Tests stream request building and validation
  - Tests stream event mapping for all response types
  - Tests complete happy path: INIT → PART_BEGIN → CHUNK → PART_END → FINALIZE
  - Tests tool call flow with prepare and result messages
  - Tests reasoning chunk handling
  - Tests error scenarios: stream error, connection error
  - Tests state transitions and sequence number management

- [x] **6.6 Document the new architecture**
  - Location: `docs/STREAMING_ARCHITECTURE.md`
  - Complete architecture diagram with all components
  - Core components documentation (StreamingStateMachine, MessageTypeHandlers, ErrorHandler, MessageStore)
  - Data types documentation (InternalMessage, DisplayMessage)
  - Data flow diagrams (happy path, error recovery)
  - File structure overview
  - Extension points for adding new message types and error types
  - Testing instructions
  - Performance considerations
  - Troubleshooting guide

- [x] **6.7 Create migration guide**
  - Location: `docs/STREAMING_MIGRATION_GUIDE.md`
  - Summary of breaking changes
  - MessageEntry → InternalMessage migration
  - Handler files → State machine migration
  - withRetrySync → withStreamingErrorHandler migration
  - Dual store access → MessageStore migration
  - MessageCard props migration
  - File changes (removed/added)
  - Import updates
  - Common migration patterns with code examples
  - Migration checklist

### Test File Structure

```
src/
├── stores/streaming/__tests__/
│   ├── streaming-state-machine.test.ts    # State machine unit tests
│   ├── message-type-handlers.test.ts      # Handler registry tests
│   └── error-handler.test.ts              # Error handling tests
├── utils/__tests__/
│   └── message-converters.test.ts         # Converter tests
└── __tests__/
    └── streaming-flow.integration.test.ts # Integration tests
```

### Documentation Structure

```
docs/
├── STREAMING_DESIGN_ANALYSIS.md    # Original complexity analysis
├── STREAMING_DESIGN_TODO.md        # This file - implementation checklist
├── STREAMING_ARCHITECTURE.md       # NEW: Architecture documentation
└── STREAMING_MIGRATION_GUIDE.md    # NEW: Developer migration guide
```

---

## Implementation Priority

| Phase | Priority | Effort | Impact | Status |
|-------|----------|--------|--------|--------|
| 1. Consolidate Handlers | High | Medium | High | ✅ COMPLETED |
| 2. Unify Stores | High | High | High | ✅ COMPLETED |
| 3. Simplify Transformations | Medium | Medium | Medium | ✅ COMPLETED |
| 4. Error Handling | Medium | Low | Medium | ✅ COMPLETED |
| 5. Refactor Hook | Low | Low | Medium | ✅ COMPLETED |
| 6. Testing & Docs | Low | Medium | High | ✅ COMPLETED |

---

## Success Metrics

After completing all phases:

- [x] Single source of truth for message state (Phase 2)
- [x] No `flushSync` calls required (Phase 2)
- [x] All state transitions documented and validated (Phase 1)
- [x] Adding a new message type requires changes to only 1-2 files (Phase 1)
- [x] Canonical internal message format defined (Phase 3)
- [x] Bidirectional converters centralized in one file (Phase 3)
- [x] MessageCard uses DisplayMessage directly (Phase 3)
- [x] Centralized error handling with configurable strategies (Phase 4)
- [x] Single retry implementation with backoff support (Phase 4)
- [x] Error types normalized for consistent handling (Phase 4)
- [x] Hook has single responsibility (orchestration only) (Phase 5)
- [x] Request building extracted to pure function (Phase 5)
- [x] Event mapping extracted to pure function (Phase 5)
- [x] Unit tests for state machine, handlers, error handler, converters (Phase 6)
- [x] Integration tests for complete streaming flow (Phase 6)
- [x] Architecture documentation with diagrams (Phase 6)
- [x] Migration guide with code examples (Phase 6)

---

## 🎉 All Phases Complete!

The streaming architecture refactoring is now complete. All 6 phases have been implemented:

1. ✅ Consolidated 9+ handler files into a single state machine
2. ✅ Unified dual store architecture into MessageStore
3. ✅ Simplified data transformations with canonical InternalMessage type
4. ✅ Centralized error handling with configurable recovery strategies
5. ✅ Refactored useSendMessageStream hook for single responsibility
6. ✅ Added comprehensive tests and documentation

For details on the new architecture, see:
- [STREAMING_ARCHITECTURE.md](./STREAMING_ARCHITECTURE.md) - Technical documentation
- [STREAMING_MIGRATION_GUIDE.md](./STREAMING_MIGRATION_GUIDE.md) - Migration instructions
