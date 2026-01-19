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

## Phase 4: Improve Error Handling

### Goal
Create a unified error handling strategy for all streaming errors.

### Tasks

- [ ] **4.1 Create StreamingErrorHandler class**
  ```typescript
  class StreamingErrorHandler {
    async handle(error: StreamingError, context: ErrorContext): Promise<ErrorResolution> {
      if (this.isRetryable(error)) {
        return this.handleWithRetry(error, context);
      }
      return this.handleFatal(error, context);
    }
    
    private isRetryable(error: StreamingError): boolean {
      return error.code === ErrorCode.PROJECT_OUT_OF_DATE ||
             error.code === ErrorCode.NETWORK_ERROR;
    }
  }
  ```
  - Location: `stores/streaming/error-handler.ts`
  - Benefit: Centralized error handling logic

- [ ] **4.2 Define error recovery strategies**
  ```typescript
  type RecoveryStrategy = 
    | { type: 'retry'; maxAttempts: number; backoff: 'exponential' | 'linear' }
    | { type: 'sync-and-retry' }
    | { type: 'show-error'; dismissable: boolean }
    | { type: 'abort' };
  ```
  - Location: `stores/streaming/types.ts`
  - Benefit: Explicit, testable recovery strategies

- [ ] **4.3 Remove duplicate retry logic**
  - Consolidate `with-retry-sync.ts` and `handleStreamError.ts` retry logic
  - Single retry implementation with configurable strategies

---

## Phase 5: Refactor useSendMessageStream Hook

### Goal
Simplify the main orchestration hook by delegating to the state machine.

### Tasks

- [ ] **5.1 Simplify hook to single responsibility**
  ```typescript
  function useSendMessageStream() {
    const machine = useStreamingStateMachine();
    
    const send = useCallback(async (message: string, selectedText: string) => {
      machine.start({ message, selectedText });
      
      await createConversationMessageStream(request, (event) => {
        machine.handleEvent(event);
      });
      
      machine.complete();
    }, [machine]);
    
    return { send, state: machine.state };
  }
  ```
  - Benefit: Hook focuses on orchestration, not event handling

- [ ] **5.2 Reduce hook dependencies**
  - Target: Maximum 5 dependencies in useCallback
  - Move logic into state machine to reduce dependencies

- [ ] **5.3 Extract request building logic**
  ```typescript
  function buildStreamRequest(params: StreamRequestParams): CreateConversationMessageStreamRequest {
    return { ... };
  }
  ```
  - Location: `utils/stream-request-builder.ts`
  - Benefit: Testable, pure function for request creation

---

## Phase 6: Testing & Documentation

### Goal
Ensure the refactored code is well-tested and documented.

### Tasks

- [ ] **6.1 Add unit tests for state machine**
  - Test all state transitions
  - Test error handling
  - Test message type handlers

- [ ] **6.2 Add integration tests for streaming flow**
  - Mock streaming API
  - Test complete happy path
  - Test error scenarios

- [ ] **6.3 Document the new architecture**
  - Update architecture diagram
  - Document state machine states and transitions
  - Add inline code comments for complex logic

- [ ] **6.4 Create migration guide**
  - Document changes for other developers
  - List breaking changes
  - Provide code migration examples

---

## Implementation Priority

| Phase | Priority | Effort | Impact | Status |
|-------|----------|--------|--------|--------|
| 1. Consolidate Handlers | High | Medium | High | ✅ COMPLETED |
| 2. Unify Stores | High | High | High | ✅ COMPLETED |
| 3. Simplify Transformations | Medium | Medium | Medium | ✅ COMPLETED |
| 4. Error Handling | Medium | Low | Medium | Not Started |
| 5. Refactor Hook | Low | Low | Medium | Not Started |
| 6. Testing & Docs | Low | Medium | High | Not Started |

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
