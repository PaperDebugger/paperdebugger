# TODO: Streaming Message Design Improvements

This document outlines a phased approach to simplify and improve the front-end streaming architecture.

---

## Phase 1: Consolidate Handlers into State Machine

### Goal
Replace 9 separate handler files with a single, cohesive state machine that manages all streaming state transitions.

### Tasks

- [ ] **1.1 Create StreamingStateMachine class**
  ```typescript
  // stores/streaming/streaming-state-machine.ts
  type StreamState = 'idle' | 'receiving' | 'finalizing' | 'error';
  
  class StreamingStateMachine {
    private state: StreamState = 'idle';
    private messageEntries: Map<string, MessageEntry> = new Map();
    
    handleEvent(event: StreamEvent): void {
      // Central event handling
    }
  }
  ```
  - Location: `stores/streaming/streaming-state-machine.ts`
  - Benefit: Single point of control for all state transitions

- [ ] **1.2 Define StreamEvent union type**
  ```typescript
  type StreamEvent = 
    | { type: 'INIT'; payload: StreamInitialization }
    | { type: 'PART_BEGIN'; payload: StreamPartBegin }
    | { type: 'CHUNK'; payload: MessageChunk }
    | { type: 'PART_END'; payload: StreamPartEnd }
    | { type: 'FINALIZE'; payload: StreamFinalization }
    | { type: 'ERROR'; payload: StreamError }
    | { type: 'INCOMPLETE'; payload: IncompleteIndicator };
  ```
  - Location: `stores/streaming/types.ts`
  - Benefit: Type-safe event handling with exhaustive checking

- [ ] **1.3 Create message type handlers registry**
  ```typescript
  // Eliminates duplicate switch statements
  const messageTypeHandlers: Record<MessageRole, MessageTypeHandler> = {
    assistant: new AssistantHandler(),
    toolCall: new ToolCallHandler(),
    toolCallPrepareArguments: new ToolCallPrepareHandler(),
    user: new NoOpHandler(),
    system: new NoOpHandler(),
    unknown: new NoOpHandler(),
  };
  ```
  - Location: `stores/streaming/message-type-handlers.ts`
  - Benefit: Add new message types without modifying multiple files

- [ ] **1.4 Delete old handler files**
  - Files to remove after migration:
    - `handlers/handleStreamInitialization.ts`
    - `handlers/handleStreamPartBegin.ts`
    - `handlers/handleMessageChunk.ts`
    - `handlers/handleStreamPartEnd.ts`
    - `handlers/handleStreamFinalization.ts`
    - `handlers/handleStreamError.ts`
    - `handlers/handleIncompleteIndicator.ts`
    - `handlers/handleError.ts`

---

## Phase 2: Unify Store Architecture

### Goal
Consolidate `streaming-message-store` and `conversation-store` message handling into a single coherent store.

### Tasks

- [ ] **2.1 Create unified message store**
  ```typescript
  // stores/message-store.ts
  interface MessageStore {
    // Finalized messages from server
    messages: Message[];
    
    // Currently streaming messages (separate from finalized)
    streamingEntries: MessageEntry[];
    
    // Computed: all displayable messages
    get allMessages(): DisplayMessage[];
    
    // Actions
    appendStreamingEntry(entry: MessageEntry): void;
    updateStreamingEntry(id: string, update: Partial<MessageEntry>): void;
    finalizeStreaming(): void;
    reset(): void;
  }
  ```
  - Location: `stores/message-store.ts`
  - Benefit: Single source of truth with clear streaming vs finalized separation

- [ ] **2.2 Create DisplayMessage type**
  ```typescript
  // Single type used by UI components
  interface DisplayMessage {
    id: string;
    type: 'user' | 'assistant' | 'toolCall' | 'error';
    content: string;
    status: 'streaming' | 'complete' | 'error';
    metadata?: MessageMetadata;
  }
  ```
  - Location: `stores/types.ts`
  - Benefit: UI components work with one consistent type

- [ ] **2.3 Remove flushSync calls**
  - Restructure update flow so React batching works naturally
  - Replace `flushSync` with proper `useSyncExternalStore` or subscription pattern
  - Files affected: `streaming-message-store.ts`, `converter.ts`

- [ ] **2.4 Migrate ChatBody to use unified store**
  - Replace:
    ```typescript
    const visibleMessages = useMemo(() => filterVisibleMessages(conversation), [conversation]);
    const streamingMessage = useStreamingMessageStore((s) => s.streamingMessage);
    ```
  - With:
    ```typescript
    const displayMessages = useMessageStore((s) => s.allMessages);
    ```

---

## Phase 3: Simplify Data Transformations

### Goal
Reduce the number of data transformations from 5+ to 2 maximum.

### Tasks

- [ ] **3.1 Define canonical internal message format**
  ```typescript
  // Internal format used throughout the app
  interface InternalMessage {
    id: string;
    role: MessageRole;
    content: string;
    status: MessageStatus;
    toolCall?: ToolCallData;
    attachments?: Attachment[];
    timestamp: number;
  }
  ```
  - Location: `types/message.ts`
  - Benefit: Single format reduces confusion

- [ ] **3.2 Create bidirectional converters**
  ```typescript
  // Only two conversions needed:
  // 1. API response → Internal format
  const fromApiMessage = (msg: ApiMessage): InternalMessage => { ... };
  
  // 2. Internal format → API request  
  const toApiMessage = (msg: InternalMessage): ApiMessage => { ... };
  ```
  - Location: `utils/message-converters.ts`
  - Benefit: Clear boundary between API types and internal types

- [ ] **3.3 Remove MessageEntry type**
  - Replace `MessageEntry` with `InternalMessage`
  - Update all components to use new type
  - Delete `stores/conversation/types.ts` (after migrating MessageEntryStatus)

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

| Phase | Priority | Effort | Impact |
|-------|----------|--------|--------|
| 1. Consolidate Handlers | High | Medium | High |
| 2. Unify Stores | High | High | High |
| 3. Simplify Transformations | Medium | Medium | Medium |
| 4. Error Handling | Medium | Low | Medium |
| 5. Refactor Hook | Low | Low | Medium |
| 6. Testing & Docs | Low | Medium | High |

---

## Success Metrics

After completing all phases:

- [ ] Total files related to streaming reduced from 15+ to ~6
- [ ] Single source of truth for message state
- [ ] No `flushSync` calls required
- [ ] All state transitions documented and validated
- [ ] Adding a new message type requires changes to only 1-2 files
- [ ] Unit test coverage > 80% for streaming logic
- [ ] Clear error handling with explicit recovery strategies

---

## Notes

- Implement phases incrementally; each phase should leave the codebase in a working state
- Consider feature flags for gradual rollout
- Performance testing recommended after Phase 2 (store unification)
