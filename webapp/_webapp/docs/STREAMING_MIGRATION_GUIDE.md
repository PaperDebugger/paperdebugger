# Migration Guide: Streaming Architecture Refactoring

This guide documents the changes made during the streaming architecture refactoring and provides migration instructions for developers working with the codebase.

## Summary of Changes

The streaming implementation has been refactored from 9+ fragmented handler files into a consolidated architecture with:

- **Single State Machine**: Centralized event handling
- **Unified Message Store**: Single source of truth for messages
- **Simplified Data Types**: Canonical `InternalMessage` format
- **Centralized Error Handling**: Configurable recovery strategies

## Breaking Changes

### 1. MessageEntry → InternalMessage

**Old Type (Removed):**
```typescript
// ❌ REMOVED
interface MessageEntry {
  id: string;
  role: MessageEntryRole;
  status: MessageEntryStatus;
  content: string;
  selectedText?: string;
  reasoning?: string;
  toolArgs?: string;
  toolResults?: string;
  // ...
}

enum MessageEntryStatus {
  PREPARING = "preparing",
  FINALIZED = "finalized",
  STALE = "stale",
}
```

**New Type:**
```typescript
// ✅ USE THIS
type InternalMessage =
  | UserMessage
  | AssistantMessage
  | ToolCallMessage
  | ToolCallPrepareMessage
  | SystemMessage
  | UnknownMessage;

type MessageStatus = "streaming" | "complete" | "error" | "stale";

interface AssistantMessage {
  id: string;
  role: "assistant";
  status: MessageStatus;
  data: {
    content: string;
    reasoning?: string;
    modelSlug?: string;
  };
}
```

**Migration:**
```typescript
// Before
import { MessageEntry, MessageEntryStatus } from "./stores/conversation/types";

function processEntry(entry: MessageEntry) {
  if (entry.status === MessageEntryStatus.PREPARING) {
    // ...
  }
  const content = entry.content;
}

// After
import { InternalMessage, isAssistantMessage } from "./types/message";

function processEntry(msg: InternalMessage) {
  if (msg.status === "streaming") {
    // ...
  }
  if (isAssistantMessage(msg)) {
    const content = msg.data.content;
  }
}
```

### 2. Handler Files → State Machine

**Old Pattern (Removed):**
```typescript
// ❌ REMOVED - Multiple handler files
import { handleStreamPartBegin } from "./handlers/handleStreamPartBegin";
import { handleMessageChunk } from "./handlers/handleMessageChunk";
import { handleStreamPartEnd } from "./handlers/handleStreamPartEnd";

// Called from useSendMessageStream
handleStreamPartBegin(payload, updateStreamingMessage);
handleMessageChunk(payload, updateStreamingMessage);
handleStreamPartEnd(payload, updateStreamingMessage);
```

**New Pattern:**
```typescript
// ✅ USE THIS
import { useStreamingStateMachine } from "./stores/streaming";

// In useSendMessageStream
const event = mapResponseToStreamEvent(response);
if (event) {
  await stateMachine.handleEvent(event, context);
}
```

### 3. withRetrySync → withStreamingErrorHandler

**Old Pattern (Deprecated):**
```typescript
// ⚠️ DEPRECATED
import { withRetrySync } from "./libs/with-retry-sync";

await withRetrySync(
  () => sendMessage(),
  sync,
  onGiveUp
);
```

**New Pattern:**
```typescript
// ✅ USE THIS
import { withStreamingErrorHandler } from "./stores/streaming";

await withStreamingErrorHandler(
  () => sendMessage(),
  {
    sync: async () => {
      const result = await sync();
      return result;
    },
    onGiveUp: () => {
      // Handle failure
    },
    context: {
      currentPrompt: prompt,
      currentSelectedText: selectedText,
      operation: "send-message",
    },
  }
);
```

### 4. Dual Store Access → MessageStore

**Old Pattern:**
```typescript
// ❌ AVOID
import { useConversationStore } from "./stores/conversation/conversation-store";
import { useStreamingMessageStore } from "./stores/streaming-message-store";

function ChatBody() {
  const messages = useConversationStore((s) => s.currentConversation.messages);
  const streamingMessage = useStreamingMessageStore((s) => s.streamingMessage);
  
  // Manually combine finalized and streaming messages
  const allMessages = [...messages, ...streamingMessage.parts];
}
```

**New Pattern:**
```typescript
// ✅ USE THIS
import { useMessageStore } from "./stores/message-store";

function ChatBody() {
  const allMessages = useMessageStore((s) => s.getAllDisplayMessages());
  // Already combined and converted to DisplayMessage
}
```

### 5. MessageCard Props

**Old Props:**
```typescript
// ❌ OLD
interface MessageCardProps {
  messageEntry: MessageEntry;
  // ...
}
```

**New Props:**
```typescript
// ✅ NEW
interface MessageCardProps {
  message: DisplayMessage;
  // ...
}
```

**Migration:**
```typescript
// Before
<MessageCard messageEntry={entry} />

// After
<MessageCard message={displayMessage} />
```

## File Changes

### Removed Files

The following handler files have been removed:

- `stores/conversation/handlers/handleStreamInitialization.ts`
- `stores/conversation/handlers/handleStreamPartBegin.ts`
- `stores/conversation/handlers/handleMessageChunk.ts`
- `stores/conversation/handlers/handleReasoningChunk.ts`
- `stores/conversation/handlers/handleStreamPartEnd.ts`
- `stores/conversation/handlers/handleStreamFinalization.ts`
- `stores/conversation/handlers/handleStreamError.ts`
- `stores/conversation/handlers/handleIncompleteIndicator.ts`
- `stores/conversation/handlers/handleError.ts`
- `stores/conversation/handlers/converter.ts`

### New Files

The following files have been added:

```
stores/streaming/
├── index.ts                      # Module exports
├── types.ts                      # Type definitions
├── streaming-state-machine.ts    # Main state machine
├── message-type-handlers.ts      # Handler registry
├── error-handler.ts              # Error handling

types/
└── message.ts                    # InternalMessage types

utils/
├── message-converters.ts         # Bidirectional converters
├── stream-request-builder.ts     # Request building
└── stream-event-mapper.ts        # Response → Event mapping
```

## Import Updates

### Old Imports (Update These)

```typescript
// ❌ REMOVE
import { MessageEntry, MessageEntryStatus } from "./stores/conversation/types";
import { useStreamingMessageStore } from "./stores/streaming-message-store";
import { withRetrySync } from "./libs/with-retry-sync";
```

### New Imports

```typescript
// ✅ ADD
import { InternalMessage, MessageStatus } from "./types/message";
import { 
  useStreamingStateMachine,
  withStreamingErrorHandler,
  StreamEvent,
} from "./stores/streaming";
import { useMessageStore } from "./stores/message-store";
import { DisplayMessage } from "./stores/types";
```

## Common Migration Patterns

### Pattern 1: Checking Message Status

```typescript
// Before
if (entry.status === MessageEntryStatus.PREPARING) {
  // streaming
} else if (entry.status === MessageEntryStatus.FINALIZED) {
  // complete
} else if (entry.status === MessageEntryStatus.STALE) {
  // stale
}

// After
if (msg.status === "streaming") {
  // streaming
} else if (msg.status === "complete") {
  // complete
} else if (msg.status === "stale") {
  // stale
}
```

### Pattern 2: Accessing Message Content

```typescript
// Before
const content = entry.content;
const reasoning = entry.reasoning;
const selectedText = entry.selectedText;

// After
if (isAssistantMessage(msg)) {
  const content = msg.data.content;
  const reasoning = msg.data.reasoning;
}
if (isUserMessage(msg)) {
  const content = msg.data.content;
  const selectedText = msg.data.selectedText;
}
```

### Pattern 3: Creating Messages

```typescript
// Before
const entry: MessageEntry = {
  id: "msg-1",
  role: "assistant",
  status: MessageEntryStatus.PREPARING,
  content: "Hello",
  reasoning: "",
};

// After
import { createAssistantMessage } from "./types/message";

const msg = createAssistantMessage("msg-1", "Hello", {
  status: "streaming",
  reasoning: "",
});
```

### Pattern 4: Converting for API

```typescript
// Before
import { messageToEntry, entryToMessage } from "./utils/converters";

const entry = messageToEntry(apiMessage);
const message = entryToMessage(entry);

// After
import { fromApiMessage, toApiMessage } from "./utils/message-converters";

const internal = fromApiMessage(apiMessage);
const message = toApiMessage(internal);
```

## Testing Changes

### Update Test Mocks

```typescript
// Before
const mockEntry: MessageEntry = {
  id: "test-1",
  role: "assistant",
  status: MessageEntryStatus.FINALIZED,
  content: "Test",
};

// After
const mockMessage: InternalMessage = {
  id: "test-1",
  role: "assistant",
  status: "complete",
  data: {
    content: "Test",
  },
};
```

### Update Test Assertions

```typescript
// Before
expect(entry.status).toBe(MessageEntryStatus.PREPARING);

// After
expect(msg.status).toBe("streaming");
```

## Backward Compatibility

### streaming-message-store.ts

The `streaming-message-store.ts` file has been kept as a thin backward compatibility layer. It delegates to the new `useStreamingStateMachine` store. If you have code using this store, it will continue to work but should be migrated.

```typescript
// Still works but deprecated
import { useStreamingMessageStore } from "./stores/streaming-message-store";

// Preferred
import { useStreamingStateMachine } from "./stores/streaming";
```

### Type Re-exports

For convenience, some types are re-exported:

```typescript
// stores/streaming/types.ts re-exports InternalMessage
export type { InternalMessage, MessageStatus } from "../../types/message";

// stores/conversation/types.ts re-exports for compatibility
export type { InternalMessage } from "../streaming/types";
```

## Checklist for Migration

- [ ] Update imports from removed handler files
- [ ] Replace `MessageEntry` with `InternalMessage`
- [ ] Replace `MessageEntryStatus` enum with `MessageStatus` string literals
- [ ] Update message content access to use `.data` property
- [ ] Replace `withRetrySync` with `withStreamingErrorHandler`
- [ ] Use `useMessageStore` instead of dual store access
- [ ] Update component props from `messageEntry` to `message`
- [ ] Run tests to verify functionality
- [ ] Remove any unused imports

## Questions?

Refer to the [Architecture Documentation](./STREAMING_ARCHITECTURE.md) for detailed explanations of the new system.
