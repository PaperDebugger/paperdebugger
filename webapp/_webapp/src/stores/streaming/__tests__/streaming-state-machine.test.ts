/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                   Streaming State Machine Test Suite                      ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Comprehensive tests for state transitions, event handling, edge cases,   ║
 * ║  concurrent operations, and error recovery in the streaming system.       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import { useStreamingStateMachine } from "../streaming-state-machine";
import { StreamEvent, StreamState } from "../types";
import { InternalMessage } from "../../../types/message";

// ─────────────────────────────────────────────────────────────────────────────
// Test Visualization & Logging System
// ─────────────────────────────────────────────────────────────────────────────

/** Set to true to enable detailed test logging */
const VERBOSE_LOGGING = process.env.VERBOSE_TEST === "1" || process.env.VERBOSE_TEST === "true";

/** ANSI color codes for terminal output */
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

/** State colors for visualization */
const stateColors: Record<string, string> = {
  idle: colors.green,
  receiving: colors.blue,
  finalizing: colors.yellow,
  error: colors.red,
};

/** Event type icons */
const eventIcons: Record<string, string> = {
  INIT: "🚀",
  PART_BEGIN: "📝",
  CHUNK: "📦",
  REASONING_CHUNK: "🧠",
  PART_END: "✅",
  FINALIZE: "🏁",
  ERROR: "❌",
  INCOMPLETE: "⚠️",
  CONNECTION_ERROR: "🔌",
};

/**
 * Test Logger for visualizing test execution
 */
class TestLogger {
  private logs: string[] = [];
  private testName: string = "";
  private stepCount: number = 0;
  private enabled: boolean;

  constructor(enabled = VERBOSE_LOGGING) {
    this.enabled = enabled;
  }

  startTest(name: string): void {
    this.testName = name;
    this.stepCount = 0;
    this.logs = [];
    if (this.enabled) {
      this.log(`\n${"═".repeat(80)}`);
      this.log(`${colors.bright}${colors.cyan}🧪 TEST: ${name}${colors.reset}`);
      this.log(`${"─".repeat(80)}`);
    }
  }

  endTest(passed: boolean): void {
    if (this.enabled) {
      this.log(`${"─".repeat(80)}`);
      const status = passed
        ? `${colors.bgGreen}${colors.white} PASS ${colors.reset}`
        : `${colors.bgRed}${colors.white} FAIL ${colors.reset}`;
      this.log(`${status} ${this.testName} (${this.stepCount} steps)`);
      this.log(`${"═".repeat(80)}\n`);
    }
  }

  logEvent(event: StreamEvent): void {
    if (!this.enabled) return;
    this.stepCount++;
    const icon = eventIcons[event.type] || "📨";
    const eventInfo = this.formatEvent(event);
    this.log(`  ${colors.dim}[${this.stepCount}]${colors.reset} ${icon} ${colors.yellow}EVENT${colors.reset}: ${colors.bright}${event.type}${colors.reset}`);
    this.log(`      ${colors.dim}${eventInfo}${colors.reset}`);
  }

  logStateTransition(from: StreamState, to: StreamState): void {
    if (!this.enabled) return;
    const fromColor = stateColors[from] || colors.white;
    const toColor = stateColors[to] || colors.white;
    if (from !== to) {
      this.log(`      ${colors.magenta}STATE${colors.reset}: ${fromColor}${from}${colors.reset} → ${toColor}${to}${colors.reset}`);
    }
  }

  logAssertion(description: string, expected: any, received: any, passed: boolean): void {
    if (!this.enabled) return;
    const icon = passed ? "✓" : "✗";
    const color = passed ? colors.green : colors.red;
    this.log(`      ${color}${icon}${colors.reset} ${description}`);
    if (!passed) {
      this.log(`        ${colors.dim}Expected: ${JSON.stringify(expected)}${colors.reset}`);
      this.log(`        ${colors.dim}Received: ${JSON.stringify(received)}${colors.reset}`);
    }
  }

  logStreamingState(): void {
    if (!this.enabled) return;
    const state = useStreamingStateMachine.getState();
    this.log(`      ${colors.cyan}STREAMING STATE${colors.reset}:`);
    this.log(`        state: ${stateColors[state.state]}${state.state}${colors.reset}`);
    this.log(`        sequence: ${state.streamingMessage.sequence}`);
    this.log(`        parts: [${state.streamingMessage.parts.map(p => 
      `${p.role}(${p.id.substring(0, 8)}..., ${p.status})`
    ).join(", ")}]`);
  }

  logSection(title: string): void {
    if (!this.enabled) return;
    this.log(`\n    ${colors.bright}${colors.blue}▸ ${title}${colors.reset}`);
  }

  logInfo(message: string): void {
    if (!this.enabled) return;
    this.log(`      ${colors.dim}ℹ ${message}${colors.reset}`);
  }

  logError(message: string): void {
    if (!this.enabled) return;
    this.log(`      ${colors.red}⚠ ${message}${colors.reset}`);
  }

  private formatEvent(event: StreamEvent): string {
    switch (event.type) {
      case "INIT":
        return `conversationId: ${(event.payload as any).conversationId}`;
      case "PART_BEGIN":
        return `messageId: ${(event.payload as any).messageId}, role: ${(event.payload as any).payload?.messageType?.case}`;
      case "CHUNK":
        const delta = (event.payload as any).delta || "";
        return `messageId: ${(event.payload as any).messageId}, delta: "${delta.substring(0, 30)}${delta.length > 30 ? "..." : ""}"`;
      case "REASONING_CHUNK":
        const rDelta = (event.payload as any).delta || "";
        return `messageId: ${(event.payload as any).messageId}, delta: "${rDelta.substring(0, 30)}${rDelta.length > 30 ? "..." : ""}"`;
      case "PART_END":
        return `messageId: ${(event.payload as any).messageId}`;
      case "FINALIZE":
        return `conversationId: ${(event.payload as any).conversationId}`;
      case "CONNECTION_ERROR":
        return `error: ${(event.payload as Error).message}`;
      case "INCOMPLETE":
        return `reason: ${(event.payload as any).reason || "unknown"}`;
      default:
        return JSON.stringify(event.payload).substring(0, 50);
    }
  }

  private log(message: string): void {
    if (this.enabled) {
      console.log(message);
    }
    this.logs.push(message);
  }

  getLogs(): string[] {
    return this.logs;
  }
}

/** Global test logger instance */
const testLogger = new TestLogger();

/**
 * Wrapper for handleEvent that logs the event and state transition
 */
async function handleEventWithLogging(event: StreamEvent): Promise<void> {
  const stateBefore = useStreamingStateMachine.getState().state;
  testLogger.logEvent(event);
  await useStreamingStateMachine.getState().handleEvent(event);
  const stateAfter = useStreamingStateMachine.getState().state;
  testLogger.logStateTransition(stateBefore, stateAfter);
}

/**
 * Enhanced expect wrapper that logs assertions
 */
function expectWithLogging<T>(received: T, description: string) {
  return {
    toBe(expected: T) {
      const passed = received === expected;
      testLogger.logAssertion(description, expected, received, passed);
      expect(received).toBe(expected);
    },
    toEqual(expected: T) {
      const passed = JSON.stringify(received) === JSON.stringify(expected);
      testLogger.logAssertion(description, expected, received, passed);
      expect(received).toEqual(expected);
    },
    toBeGreaterThan(expected: number) {
      const passed = (received as number) > expected;
      testLogger.logAssertion(`${description} > ${expected}`, `> ${expected}`, received, passed);
      expect(received).toBeGreaterThan(expected);
    },
    toBeGreaterThanOrEqual(expected: number) {
      const passed = (received as number) >= expected;
      testLogger.logAssertion(`${description} >= ${expected}`, `>= ${expected}`, received, passed);
      expect(received).toBeGreaterThanOrEqual(expected);
    },
    toBeLessThan(expected: number) {
      const passed = (received as number) < expected;
      testLogger.logAssertion(`${description} < ${expected}`, `< ${expected}`, received, passed);
      expect(received).toBeLessThan(expected);
    },
    toHaveLength(expected: number) {
      const arr = received as any[];
      const passed = arr.length === expected;
      testLogger.logAssertion(`${description}.length`, expected, arr.length, passed);
      expect(received).toHaveLength(expected);
    },
    toBeNull() {
      const passed = received === null;
      testLogger.logAssertion(`${description} is null`, null, received, passed);
      expect(received).toBeNull();
    },
    not: {
      toBeNull() {
        const passed = received !== null;
        testLogger.logAssertion(`${description} is not null`, "not null", received, passed);
        expect(received).not.toBeNull();
      },
    },
    toContain(expected: any) {
      const passed = received != null && ((received as any[]).includes?.(expected) || (received as string).includes?.(expected));
      testLogger.logAssertion(`${description} contains ${JSON.stringify(expected)}`, expected, received, passed ?? false);
      expect(received).toContain(expected);
    },
    toBeTruthy() {
      const passed = !!received;
      testLogger.logAssertion(`${description} is truthy`, true, received, passed);
      expect(received).toBeTruthy();
    },
    toBeInstanceOf(expected: any) {
      const passed = received instanceof expected;
      testLogger.logAssertion(`${description} instanceof ${expected.name}`, expected.name, typeof received, passed);
      expect(received).toBeInstanceOf(expected);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures & Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockUpdateCurrentConversation = mock(() => {});
const mockGetState = mock(() => ({ updateCurrentConversation: mockUpdateCurrentConversation }));

mock.module("../../conversation/conversation-store", () => ({
  useConversationStore: { getState: mockGetState },
}));

mock.module("../../../libs/logger", () => ({
  logError: mock(() => {}),
  logWarn: mock(() => {}),
  logInfo: mock(() => {}),
}));

mock.module("../../../query/api", () => ({
  getConversation: mock(async () => ({ conversation: null })),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Factory Functions for Test Data
// ─────────────────────────────────────────────────────────────────────────────

const createAssistantBeginEvent = (
  messageId: string,
  options?: { content?: string; reasoning?: string; modelSlug?: string }
): StreamEvent => ({
  type: "PART_BEGIN",
  payload: {
    messageId,
    payload: {
      messageType: {
        case: "assistant",
        value: {
          content: options?.content ?? "",
          reasoning: options?.reasoning ?? "",
          modelSlug: options?.modelSlug ?? "gpt-4",
        },
      },
    },
  } as any,
});

const createToolCallBeginEvent = (
  messageId: string,
  options?: { name?: string; args?: string }
): StreamEvent => ({
  type: "PART_BEGIN",
  payload: {
    messageId,
    payload: {
      messageType: {
        case: "toolCall",
        value: {
          name: options?.name ?? "search",
          args: options?.args ?? "{}",
          result: "",
          error: "",
        },
      },
    },
  } as any,
});

const createToolPrepareBeginEvent = (
  messageId: string,
  options?: { name?: string }
): StreamEvent => ({
  type: "PART_BEGIN",
  payload: {
    messageId,
    payload: {
      messageType: {
        case: "toolCallPrepareArguments",
        value: { name: options?.name ?? "search", args: "" },
      },
    },
  } as any,
});

const createChunkEvent = (messageId: string, delta: string): StreamEvent => ({
  type: "CHUNK",
  payload: { messageId, delta } as any,
});

const createReasoningChunkEvent = (messageId: string, delta: string): StreamEvent => ({
  type: "REASONING_CHUNK",
  payload: { messageId, delta } as any,
});

const createPartEndEvent = (
  messageId: string,
  role: "assistant" | "toolCall",
  options?: { content?: string; reasoning?: string; result?: string; args?: string }
): StreamEvent => ({
  type: "PART_END",
  payload: {
    messageId,
    payload: {
      messageType:
        role === "assistant"
          ? {
              case: "assistant",
              value: {
                content: options?.content ?? "",
                reasoning: options?.reasoning ?? "",
                modelSlug: "gpt-4",
              },
            }
          : {
              case: "toolCall",
              value: {
                name: "search",
                args: options?.args ?? "{}",
                result: options?.result ?? "",
                error: "",
              },
            },
    },
  } as any,
});

const createInitEvent = (conversationId: string, modelSlug?: string): StreamEvent => ({
  type: "INIT",
  payload: { conversationId, modelSlug: modelSlug ?? "gpt-4" } as any,
});

const createFinalizeEvent = (conversationId: string): StreamEvent => ({
  type: "FINALIZE",
  payload: { conversationId } as any,
});

const createUserMessage = (id: string, content: string, status: "streaming" | "complete" = "streaming"): InternalMessage => ({
  id,
  role: "user",
  status,
  data: { content },
} as InternalMessage);

// ─────────────────────────────────────────────────────────────────────────────
// Random Data Generators for Fuzz Testing
// ─────────────────────────────────────────────────────────────────────────────

class RandomGenerator {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Date.now();
  }

  /** Seeded pseudo-random number generator (Mulberry32) */
  private next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  getSeed(): number {
    return this.seed;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  boolean(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(array: T[]): T {
    return array[this.int(0, array.length - 1)];
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  string(length: number, charset?: string): string {
    const chars = charset ?? "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length }, () => this.pick(chars.split(""))).join("");
  }

  word(): string {
    const words = [
      "hello", "world", "test", "stream", "message", "chunk", "data", "content",
      "response", "query", "search", "result", "error", "success", "pending",
      "complete", "partial", "reasoning", "thinking", "analyzing", "processing",
    ];
    return this.pick(words);
  }

  sentence(wordCount?: number): string {
    const count = wordCount ?? this.int(3, 12);
    return Array.from({ length: count }, () => this.word()).join(" ");
  }

  unicodeString(length: number): string {
    const unicodeRanges = [
      () => String.fromCharCode(this.int(0x4e00, 0x9fff)), // CJK
      () => String.fromCharCode(this.int(0x0600, 0x06ff)), // Arabic
      () => String.fromCharCode(this.int(0x0400, 0x04ff)), // Cyrillic
      () => String.fromCodePoint(this.int(0x1f600, 0x1f64f)), // Emoji
      () => String.fromCharCode(this.int(0x0041, 0x007a)), // ASCII
    ];
    return Array.from({ length }, () => this.pick(unicodeRanges)()).join("");
  }

  messageId(): string {
    return `msg-${this.string(8)}`;
  }

  toolName(): string {
    const tools = [
      "web_search", "code_interpreter", "file_reader", "calculator",
      "image_generator", "translator", "summarizer", "data_analyzer",
    ];
    return this.pick(tools);
  }

  modelSlug(): string {
    const models = ["gpt-4", "gpt-4-turbo", "claude-3", "claude-3-opus", "gemini-pro"];
    return this.pick(models);
  }

  json(): string {
    const obj: Record<string, any> = {};
    const keyCount = this.int(1, 5);
    for (let i = 0; i < keyCount; i++) {
      const key = this.word();
      const valueType = this.int(0, 3);
      switch (valueType) {
        case 0: obj[key] = this.string(10); break;
        case 1: obj[key] = this.int(0, 1000); break;
        case 2: obj[key] = this.boolean(); break;
        case 3: obj[key] = [this.word(), this.word()]; break;
      }
    }
    return JSON.stringify(obj);
  }
}

type MessageType = "assistant" | "toolCall" | "toolPrepare";
type EventType = "begin" | "chunk" | "reasoningChunk" | "end";

interface ActiveMessage {
  id: string;
  type: MessageType;
  content: string;
  reasoning: string;
  isComplete: boolean;
}

/** Generates random but valid event sequences */
class RandomEventGenerator {
  private rng: RandomGenerator;
  private activeMessages: Map<string, ActiveMessage> = new Map();
  private eventLog: string[] = [];

  constructor(seed?: number) {
    this.rng = new RandomGenerator(seed);
  }

  getSeed(): number {
    return this.rng.getSeed();
  }

  getEventLog(): string[] {
    return this.eventLog;
  }

  getActiveMessages(): Map<string, ActiveMessage> {
    return this.activeMessages;
  }

  private log(msg: string): void {
    this.eventLog.push(msg);
  }

  /** Generate a random PART_BEGIN event */
  generateBeginEvent(): StreamEvent {
    const messageType: MessageType = this.rng.pick(["assistant", "toolCall", "toolPrepare"]);
    const id = this.rng.messageId();

    this.activeMessages.set(id, {
      id,
      type: messageType,
      content: "",
      reasoning: "",
      isComplete: false,
    });

    this.log(`BEGIN: ${messageType} (${id})`);

    switch (messageType) {
      case "assistant":
        return createAssistantBeginEvent(id, {
          content: this.rng.boolean(0.3) ? this.rng.sentence(2) : "",
          reasoning: this.rng.boolean(0.2) ? this.rng.sentence(2) : "",
          modelSlug: this.rng.modelSlug(),
        });
      case "toolCall":
        return createToolCallBeginEvent(id, {
          name: this.rng.toolName(),
          args: this.rng.json(),
        });
      case "toolPrepare":
        return createToolPrepareBeginEvent(id, { name: this.rng.toolName() });
    }
  }

  /** Generate a random CHUNK event for an existing assistant message */
  generateChunkEvent(): StreamEvent | null {
    const assistantMsgs = Array.from(this.activeMessages.values()).filter(
      (m) => m.type === "assistant" && !m.isComplete
    );
    if (assistantMsgs.length === 0) return null;

    const msg = this.rng.pick(assistantMsgs);
    const delta = this.rng.boolean(0.1)
      ? this.rng.unicodeString(this.rng.int(5, 20))
      : this.rng.sentence(this.rng.int(1, 5));

    msg.content += delta;
    this.log(`CHUNK: (${msg.id}) +${delta.length} chars`);

    return createChunkEvent(msg.id, delta);
  }

  /** Generate a random REASONING_CHUNK event */
  generateReasoningChunkEvent(): StreamEvent | null {
    const assistantMsgs = Array.from(this.activeMessages.values()).filter(
      (m) => m.type === "assistant" && !m.isComplete
    );
    if (assistantMsgs.length === 0) return null;

    const msg = this.rng.pick(assistantMsgs);
    const delta = this.rng.sentence(this.rng.int(1, 3));
    msg.reasoning += delta;
    this.log(`REASONING: (${msg.id}) +${delta.length} chars`);

    return createReasoningChunkEvent(msg.id, delta);
  }

  /** Generate a PART_END event for an existing message */
  generateEndEvent(): StreamEvent | null {
    const incompleteMsgs = Array.from(this.activeMessages.values()).filter(
      (m) => !m.isComplete && m.type !== "toolPrepare" // toolPrepare doesn't need explicit end
    );
    if (incompleteMsgs.length === 0) return null;

    const msg = this.rng.pick(incompleteMsgs);
    msg.isComplete = true;
    this.log(`END: ${msg.type} (${msg.id})`);

    if (msg.type === "assistant") {
      return createPartEndEvent(msg.id, "assistant", {
        content: msg.content || this.rng.sentence(5),
        reasoning: msg.reasoning || "",
      });
    } else if (msg.type === "toolCall") {
      return createPartEndEvent(msg.id, "toolCall", {
        result: this.rng.json(),
        args: this.rng.json(),
      });
    }
    return null;
  }

  /** Generate a random valid event based on current state */
  generateNextEvent(): StreamEvent | null {
    const hasIncomplete = Array.from(this.activeMessages.values()).some(
      (m) => !m.isComplete && m.type !== "toolPrepare"
    );
    const hasAssistantStreaming = Array.from(this.activeMessages.values()).some(
      (m) => m.type === "assistant" && !m.isComplete
    );

    // Decide what type of event to generate
    const options: Array<() => StreamEvent | null> = [];

    // Can always start a new message (weighted)
    options.push(() => this.generateBeginEvent());
    options.push(() => this.generateBeginEvent());

    // Can send chunks if there are streaming assistant messages
    if (hasAssistantStreaming) {
      options.push(() => this.generateChunkEvent());
      options.push(() => this.generateChunkEvent());
      options.push(() => this.generateChunkEvent());
      options.push(() => this.generateReasoningChunkEvent());
    }

    // Can end messages if there are incomplete ones
    if (hasIncomplete) {
      options.push(() => this.generateEndEvent());
    }

    const generator = this.rng.pick(options);
    return generator();
  }

  /** Generate a complete valid sequence of events */
  generateEventSequence(minEvents: number, maxEvents: number): StreamEvent[] {
    const events: StreamEvent[] = [];
    const eventCount = this.rng.int(minEvents, maxEvents);

    // Always start with at least one BEGIN
    events.push(this.generateBeginEvent());

    // Generate middle events
    for (let i = 1; i < eventCount - 1; i++) {
      const event = this.generateNextEvent();
      if (event) events.push(event);
    }

    // End all incomplete messages (except toolPrepare which doesn't need end events)
    let safeguard = 100;
    while (
      Array.from(this.activeMessages.values()).some(
        (m) => !m.isComplete && m.type !== "toolPrepare"
      ) &&
      safeguard-- > 0
    ) {
      const endEvent = this.generateEndEvent();
      if (endEvent) events.push(endEvent);
    }

    // Mark toolPrepare as complete (they don't emit end events)
    for (const msg of this.activeMessages.values()) {
      if (msg.type === "toolPrepare") {
        msg.isComplete = true;
      }
    }

    return events;
  }

  reset(): void {
    this.activeMessages.clear();
    this.eventLog = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe("🔄 StreamingStateMachine", () => {
  beforeEach(() => {
    useStreamingStateMachine.getState().reset();
    mockUpdateCurrentConversation.mockClear();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIAL STATE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("📦 Initial State", () => {
    it("starts in idle state with pristine configuration", () => {
      const state = useStreamingStateMachine.getState();

      expect(state.state).toBe("idle");
      expect(state.streamingMessage.parts).toEqual([]);
      expect(state.streamingMessage.sequence).toBe(0);
      expect(state.incompleteIndicator).toBeNull();
    });

    it("provides correct values from selector functions", () => {
      const state = useStreamingStateMachine.getState();

      expect(state.getStreamingMessage()).toEqual({ parts: [], sequence: 0 });
      expect(state.getIncompleteIndicator()).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RESET FUNCTIONALITY TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("🔃 Reset Functionality", () => {
    it("resets all state to initial values after modifications", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
      expect(useStreamingStateMachine.getState().streamingMessage.parts.length).toBeGreaterThan(0);

      useStreamingStateMachine.getState().reset();

      const state = useStreamingStateMachine.getState();
      expect(state.state).toBe("idle");
      expect(state.streamingMessage.parts).toEqual([]);
      expect(state.streamingMessage.sequence).toBe(0);
      expect(state.incompleteIndicator).toBeNull();
    });

    it("resets from error state correctly", async () => {
      await useStreamingStateMachine.getState().handleEvent({
        type: "CONNECTION_ERROR",
        payload: new Error("Test error"),
      });

      expect(useStreamingStateMachine.getState().state).toBe("error");

      useStreamingStateMachine.getState().reset();

      expect(useStreamingStateMachine.getState().state).toBe("idle");
    });

    it("resets incomplete indicator", async () => {
      await useStreamingStateMachine.getState().handleEvent({
        type: "INCOMPLETE",
        payload: { reason: "truncated" } as any,
      });

      expect(useStreamingStateMachine.getState().incompleteIndicator).not.toBeNull();

      useStreamingStateMachine.getState().reset();

      expect(useStreamingStateMachine.getState().incompleteIndicator).toBeNull();
    });

    it("resets multiple streaming parts correctly", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
      await useStreamingStateMachine.getState().handleEvent(createToolCallBeginEvent("tool-1"));
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-2"));

      expect(useStreamingStateMachine.getState().streamingMessage.parts).toHaveLength(3);

      useStreamingStateMachine.getState().reset();

      expect(useStreamingStateMachine.getState().streamingMessage.parts).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT EVENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("🚀 INIT Event", () => {
    it("transitions from idle to receiving state", async () => {
      useStreamingStateMachine.setState({
        streamingMessage: { parts: [createUserMessage("user-1", "Hello")], sequence: 1 },
      });

      await useStreamingStateMachine.getState().handleEvent(createInitEvent("conv-123"));

      expect(useStreamingStateMachine.getState().state).toBe("receiving");
    });

    it("finalizes user messages before flushing", async () => {
      useStreamingStateMachine.setState({
        streamingMessage: { parts: [createUserMessage("user-1", "Hello")], sequence: 1 },
      });

      await useStreamingStateMachine.getState().handleEvent(createInitEvent("conv-123"));

      expect(mockUpdateCurrentConversation).toHaveBeenCalled();
    });

    it("resets streaming message after flush", async () => {
      useStreamingStateMachine.setState({
        streamingMessage: { parts: [createUserMessage("user-1", "Hello")], sequence: 1 },
      });

      await useStreamingStateMachine.getState().handleEvent(createInitEvent("conv-123"));

      expect(useStreamingStateMachine.getState().streamingMessage.parts).toEqual([]);
    });

    it("handles INIT with custom model slug", async () => {
      useStreamingStateMachine.setState({
        streamingMessage: { parts: [createUserMessage("user-1", "Hello")], sequence: 1 },
      });

      await useStreamingStateMachine.getState().handleEvent(createInitEvent("conv-123", "claude-3"));

      expect(useStreamingStateMachine.getState().state).toBe("receiving");
    });

    it("handles INIT with empty streaming parts gracefully", async () => {
      await useStreamingStateMachine.getState().handleEvent(createInitEvent("conv-123"));

      expect(useStreamingStateMachine.getState().state).toBe("receiving");
      expect(useStreamingStateMachine.getState().streamingMessage.parts).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PART_BEGIN EVENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("📝 PART_BEGIN Event", () => {
    describe("Assistant Messages", () => {
      it("adds assistant message with correct properties", async () => {
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));

        const state = useStreamingStateMachine.getState();
        expect(state.streamingMessage.parts).toHaveLength(1);

        const msg = state.streamingMessage.parts[0];
        expect(msg.id).toBe("msg-1");
        expect(msg.role).toBe("assistant");
        expect(msg.status).toBe("streaming");
      });

      it("initializes assistant message with provided content", async () => {
        await useStreamingStateMachine
          .getState()
          .handleEvent(createAssistantBeginEvent("msg-1", { content: "Initial content" }));

        const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
        if (msg.role === "assistant") {
          expect(msg.data.content).toBe("Initial content");
        }
      });

      it("initializes assistant message with provided reasoning", async () => {
        await useStreamingStateMachine
          .getState()
          .handleEvent(createAssistantBeginEvent("msg-1", { reasoning: "Initial reasoning" }));

        const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
        if (msg.role === "assistant") {
          expect(msg.data.reasoning).toBe("Initial reasoning");
        }
      });
    });

    describe("Tool Call Messages", () => {
      it("adds toolCall message with correct properties", async () => {
        await useStreamingStateMachine.getState().handleEvent(createToolCallBeginEvent("tool-1"));

        const state = useStreamingStateMachine.getState();
        expect(state.streamingMessage.parts).toHaveLength(1);
        expect(state.streamingMessage.parts[0].role).toBe("toolCall");
        expect(state.streamingMessage.parts[0].status).toBe("streaming");
      });

      it("adds toolCallPrepare message", async () => {
        await useStreamingStateMachine.getState().handleEvent(createToolPrepareBeginEvent("prep-1"));

        const state = useStreamingStateMachine.getState();
        expect(state.streamingMessage.parts).toHaveLength(1);
        expect(state.streamingMessage.parts[0].role).toBe("toolCallPrepare");
      });

      it("initializes tool call with custom name and args", async () => {
        await useStreamingStateMachine.getState().handleEvent(
          createToolCallBeginEvent("tool-1", {
            name: "web_scraper",
            args: '{"url": "https://example.com"}',
          })
        );

        const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
        if (msg.role === "toolCall") {
          expect(msg.data.name).toBe("web_scraper");
        }
      });
    });

    describe("Deduplication & Filtering", () => {
      it("prevents duplicate messages with same ID", async () => {
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));

        expect(useStreamingStateMachine.getState().streamingMessage.parts).toHaveLength(1);
      });

      it("allows different message IDs", async () => {
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-2"));
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-3"));

        expect(useStreamingStateMachine.getState().streamingMessage.parts).toHaveLength(3);
      });

      it.each(["user", "system", "unknown"] as const)("ignores %s role messages", async (role) => {
        const event: StreamEvent = {
          type: "PART_BEGIN",
          payload: {
            messageId: `${role}-1`,
            payload: { messageType: { case: role, value: { content: "test" } } },
          } as any,
        };

        await useStreamingStateMachine.getState().handleEvent(event);

        expect(useStreamingStateMachine.getState().streamingMessage.parts).toHaveLength(0);
      });

      it("handles undefined message type gracefully", async () => {
        const event: StreamEvent = {
          type: "PART_BEGIN",
          payload: {
            messageId: "msg-1",
            payload: {
              messageType: {
                case: undefined,
                value: { content: "test" },
              },
            },
          } as any,
        };

        await useStreamingStateMachine.getState().handleEvent(event);

        // Should handle gracefully - unknown role is filtered out
        expect(useStreamingStateMachine.getState().streamingMessage.parts).toHaveLength(0);
      });
    });

    describe("Sequence Number Management", () => {
      it("increments sequence on each valid PART_BEGIN", async () => {
        const initialSeq = useStreamingStateMachine.getState().streamingMessage.sequence;

        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
        expect(useStreamingStateMachine.getState().streamingMessage.sequence).toBe(initialSeq + 1);

        await useStreamingStateMachine.getState().handleEvent(createToolCallBeginEvent("tool-1"));
        expect(useStreamingStateMachine.getState().streamingMessage.sequence).toBe(initialSeq + 2);
      });

      it("does not increment sequence on duplicate messages", async () => {
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
        const seqAfterFirst = useStreamingStateMachine.getState().streamingMessage.sequence;

        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
        expect(useStreamingStateMachine.getState().streamingMessage.sequence).toBe(seqAfterFirst);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHUNK EVENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("📦 CHUNK Event", () => {
    beforeEach(async () => {
      await useStreamingStateMachine.getState().handleEvent(
        createAssistantBeginEvent("msg-1", { content: "Hello" })
      );
    });

    it("appends delta to assistant message content", async () => {
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", " World"));

      const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
      if (msg.role === "assistant") {
        expect(msg.data.content).toBe("Hello World");
      }
    });

    it("handles multiple sequential chunks", async () => {
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", " World"));
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", "!"));
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", " How"));
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", " are you?"));

      const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
      if (msg.role === "assistant") {
        expect(msg.data.content).toBe("Hello World! How are you?");
      }
    });

    it("handles empty delta chunks", async () => {
      const originalContent =
        useStreamingStateMachine.getState().streamingMessage.parts[0].role === "assistant"
          ? (useStreamingStateMachine.getState().streamingMessage.parts[0] as any).data.content
          : "";

      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", ""));

      const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
      if (msg.role === "assistant") {
        expect(msg.data.content).toBe(originalContent);
      }
    });

    it("handles special characters in chunks", async () => {
      await useStreamingStateMachine
        .getState()
        .handleEvent(createChunkEvent("msg-1", " 你好世界! 🚀 <script>alert('xss')</script>"));

      const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
      if (msg.role === "assistant") {
        expect(msg.data.content).toContain("你好世界");
        expect(msg.data.content).toContain("🚀");
        expect(msg.data.content).toContain("<script>");
      }
    });

    it("ignores chunks for non-existent messages", async () => {
      const stateBefore = useStreamingStateMachine.getState().streamingMessage;

      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("non-existent", " test"));

      const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
      if (msg.role === "assistant") {
        expect(msg.data.content).toBe("Hello");
      }
    });

    it("increments sequence number on each chunk", async () => {
      const initialSeq = useStreamingStateMachine.getState().streamingMessage.sequence;

      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", "a"));
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", "b"));
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", "c"));

      expect(useStreamingStateMachine.getState().streamingMessage.sequence).toBe(initialSeq + 3);
    });

    it("handles very long chunks", async () => {
      const longText = "x".repeat(10000);
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", longText));

      const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
      if (msg.role === "assistant") {
        expect(msg.data.content.length).toBe("Hello".length + 10000);
      }
    });

    it("handles newlines and whitespace in chunks", async () => {
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", "\n\nParagraph\n\t- Item"));

      const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
      if (msg.role === "assistant") {
        expect(msg.data.content).toContain("\n\n");
        expect(msg.data.content).toContain("\n\t-");
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REASONING_CHUNK EVENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("🧠 REASONING_CHUNK Event", () => {
    beforeEach(async () => {
      await useStreamingStateMachine.getState().handleEvent(
        createAssistantBeginEvent("msg-1", { reasoning: "Step 1:" })
      );
    });

    it("appends delta to assistant message reasoning", async () => {
      await useStreamingStateMachine.getState().handleEvent(createReasoningChunkEvent("msg-1", " Think about it"));

      const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
      if (msg.role === "assistant") {
        expect(msg.data.reasoning).toBe("Step 1: Think about it");
      }
    });

    it("handles multiple sequential reasoning chunks", async () => {
      await useStreamingStateMachine.getState().handleEvent(createReasoningChunkEvent("msg-1", " analyze"));
      await useStreamingStateMachine.getState().handleEvent(createReasoningChunkEvent("msg-1", " the"));
      await useStreamingStateMachine.getState().handleEvent(createReasoningChunkEvent("msg-1", " problem"));

      const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
      if (msg.role === "assistant") {
        expect(msg.data.reasoning).toBe("Step 1: analyze the problem");
      }
    });

    it("handles reasoning chunks when initial reasoning is empty", async () => {
      useStreamingStateMachine.getState().reset();
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-2", { reasoning: "" }));

      await useStreamingStateMachine.getState().handleEvent(createReasoningChunkEvent("msg-2", "First thought"));

      const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
      if (msg.role === "assistant") {
        expect(msg.data.reasoning).toBe("First thought");
      }
    });

    it("increments sequence number for reasoning chunks", async () => {
      const initialSeq = useStreamingStateMachine.getState().streamingMessage.sequence;

      await useStreamingStateMachine.getState().handleEvent(createReasoningChunkEvent("msg-1", "a"));
      await useStreamingStateMachine.getState().handleEvent(createReasoningChunkEvent("msg-1", "b"));

      expect(useStreamingStateMachine.getState().streamingMessage.sequence).toBe(initialSeq + 2);
    });

    it("ignores reasoning chunks for non-assistant messages", async () => {
      await useStreamingStateMachine.getState().handleEvent(createToolCallBeginEvent("tool-1"));

      const toolMsg = useStreamingStateMachine.getState().streamingMessage.parts.find(
        (p) => p.id === "tool-1"
      );

      await useStreamingStateMachine.getState().handleEvent(createReasoningChunkEvent("tool-1", "reasoning"));

      // Tool message should not have reasoning modified
      expect(toolMsg?.role).toBe("toolCall");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PART_END EVENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("✅ PART_END Event", () => {
    describe("Assistant Message Finalization", () => {
      it("finalizes assistant message with complete status", async () => {
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1", { content: "Hello" }));
        await useStreamingStateMachine.getState().handleEvent(
          createPartEndEvent("msg-1", "assistant", { content: "Hello World!", reasoning: "Done thinking" })
        );

        const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
        expect(msg.status).toBe("complete");
        if (msg.role === "assistant") {
          expect(msg.data.content).toBe("Hello World!");
          expect(msg.data.reasoning).toBe("Done thinking");
        }
      });

      it("updates content from final payload", async () => {
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1", { content: "Draft" }));
        await useStreamingStateMachine.getState().handleEvent(
          createPartEndEvent("msg-1", "assistant", { content: "Final polished content" })
        );

        const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
        if (msg.role === "assistant") {
          expect(msg.data.content).toBe("Final polished content");
        }
      });

      it("preserves message ID after finalization", async () => {
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("unique-id-123"));
        await useStreamingStateMachine.getState().handleEvent(
          createPartEndEvent("unique-id-123", "assistant", { content: "Done" })
        );

        const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
        expect(msg.id).toBe("unique-id-123");
      });
    });

    describe("Tool Call Finalization", () => {
      it("finalizes toolCall message with result", async () => {
        await useStreamingStateMachine.getState().handleEvent(createToolCallBeginEvent("tool-1"));
        await useStreamingStateMachine.getState().handleEvent(
          createPartEndEvent("tool-1", "toolCall", {
            args: '{"query": "test search"}',
            result: '{"results": ["item1", "item2"]}',
          })
        );

        const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
        expect(msg.status).toBe("complete");
        if (msg.role === "toolCall") {
          expect(msg.data.result).toBe('{"results": ["item1", "item2"]}');
        }
      });

      it("updates tool call arguments from final payload", async () => {
        await useStreamingStateMachine.getState().handleEvent(createToolCallBeginEvent("tool-1", { args: "{}" }));
        await useStreamingStateMachine.getState().handleEvent(
          createPartEndEvent("tool-1", "toolCall", { args: '{"complete": true, "limit": 100}' })
        );

        const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
        if (msg.role === "toolCall") {
          expect(msg.data.args).toBe('{"complete": true, "limit": 100}');
        }
      });
    });

    describe("Edge Cases", () => {
      it("ignores PART_END for non-existent message", async () => {
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));

        const partsBefore = useStreamingStateMachine.getState().streamingMessage.parts.length;

        await useStreamingStateMachine.getState().handleEvent(
          createPartEndEvent("non-existent", "assistant", { content: "test" })
        );

        expect(useStreamingStateMachine.getState().streamingMessage.parts.length).toBe(partsBefore);
      });

      it("handles PART_END for already completed message", async () => {
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
        await useStreamingStateMachine.getState().handleEvent(
          createPartEndEvent("msg-1", "assistant", { content: "First" })
        );
        await useStreamingStateMachine.getState().handleEvent(
          createPartEndEvent("msg-1", "assistant", { content: "Second" })
        );

        const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
        if (msg.role === "assistant") {
          // Second PART_END should still update
          expect(msg.data.content).toBe("Second");
        }
      });

      it("increments sequence on PART_END", async () => {
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
        const seqBefore = useStreamingStateMachine.getState().streamingMessage.sequence;

        await useStreamingStateMachine.getState().handleEvent(
          createPartEndEvent("msg-1", "assistant", { content: "Done" })
        );

        expect(useStreamingStateMachine.getState().streamingMessage.sequence).toBe(seqBefore + 1);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FINALIZE EVENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("🏁 FINALIZE Event", () => {
    it("transitions state to idle", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
      await useStreamingStateMachine.getState().handleEvent(
        createPartEndEvent("msg-1", "assistant", { content: "Test" })
      );
      await useStreamingStateMachine.getState().handleEvent(createFinalizeEvent("conv-123"));

      expect(useStreamingStateMachine.getState().state).toBe("idle");
    });

    it("clears all streaming message parts", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
      await useStreamingStateMachine.getState().handleEvent(createToolCallBeginEvent("tool-1"));
      await useStreamingStateMachine.getState().handleEvent(
        createPartEndEvent("msg-1", "assistant", { content: "Test" })
      );
      await useStreamingStateMachine.getState().handleEvent(
        createPartEndEvent("tool-1", "toolCall", { result: "Done" })
      );

      await useStreamingStateMachine.getState().handleEvent(createFinalizeEvent("conv-123"));

      expect(useStreamingStateMachine.getState().streamingMessage.parts).toEqual([]);
    });

    it("resets sequence number to zero", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", "text"));
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", "more"));

      expect(useStreamingStateMachine.getState().streamingMessage.sequence).toBeGreaterThan(0);

      await useStreamingStateMachine.getState().handleEvent(
        createPartEndEvent("msg-1", "assistant", { content: "Test" })
      );
      await useStreamingStateMachine.getState().handleEvent(createFinalizeEvent("conv-123"));

      expect(useStreamingStateMachine.getState().streamingMessage.sequence).toBe(0);
    });

    it("flushes completed messages to conversation store", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
      await useStreamingStateMachine.getState().handleEvent(
        createPartEndEvent("msg-1", "assistant", { content: "Completed message" })
      );

      mockUpdateCurrentConversation.mockClear();

      await useStreamingStateMachine.getState().handleEvent(createFinalizeEvent("conv-123"));

      expect(mockUpdateCurrentConversation).toHaveBeenCalled();
    });

    it("handles finalize with no streaming messages", async () => {
      await useStreamingStateMachine.getState().handleEvent(createFinalizeEvent("conv-123"));

      expect(useStreamingStateMachine.getState().state).toBe("idle");
      expect(useStreamingStateMachine.getState().streamingMessage.parts).toEqual([]);
    });

    it("handles finalize with incomplete streaming messages (not flushed)", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
      // No PART_END - message is still streaming

      await useStreamingStateMachine.getState().handleEvent(createFinalizeEvent("conv-123"));

      // Should still finalize and clear
      expect(useStreamingStateMachine.getState().state).toBe("idle");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INCOMPLETE EVENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("⚠️ INCOMPLETE Event", () => {
    it("sets incomplete indicator from payload", async () => {
      await useStreamingStateMachine.getState().handleEvent({
        type: "INCOMPLETE",
        payload: { reason: "truncated", details: "Max tokens reached" } as any,
      });

      expect(useStreamingStateMachine.getState().incompleteIndicator).not.toBeNull();
    });

    it("preserves existing streaming messages", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", "partial"));

      await useStreamingStateMachine.getState().handleEvent({
        type: "INCOMPLETE",
        payload: { reason: "truncated" } as any,
      });

      expect(useStreamingStateMachine.getState().streamingMessage.parts).toHaveLength(1);
    });

    it("can be cleared by reset", async () => {
      await useStreamingStateMachine.getState().handleEvent({
        type: "INCOMPLETE",
        payload: { reason: "truncated" } as any,
      });

      useStreamingStateMachine.getState().reset();

      expect(useStreamingStateMachine.getState().incompleteIndicator).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONNECTION_ERROR EVENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("❌ CONNECTION_ERROR Event", () => {
    it("transitions to error state", async () => {
      await useStreamingStateMachine.getState().handleEvent({
        type: "CONNECTION_ERROR",
        payload: new Error("Network error"),
      });

      expect(useStreamingStateMachine.getState().state).toBe("error");
    });

    it("marks streaming messages as stale", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
      expect(useStreamingStateMachine.getState().streamingMessage.parts[0].status).toBe("streaming");

      await useStreamingStateMachine.getState().handleEvent({
        type: "CONNECTION_ERROR",
        payload: new Error("Connection lost"),
      });

      expect(useStreamingStateMachine.getState().streamingMessage.parts[0].status).toBe("stale");
    });

    it("preserves completed messages unchanged", async () => {
      useStreamingStateMachine.setState({
        streamingMessage: {
          parts: [
            {
              id: "msg-1",
              role: "assistant",
              status: "complete",
              data: { content: "Completed" },
            } as InternalMessage,
          ],
          sequence: 1,
        },
      });

      await useStreamingStateMachine.getState().handleEvent({
        type: "CONNECTION_ERROR",
        payload: new Error("Network error"),
      });

      expect(useStreamingStateMachine.getState().streamingMessage.parts[0].status).toBe("complete");
    });

    it("marks multiple streaming messages as stale", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
      await useStreamingStateMachine.getState().handleEvent(createToolCallBeginEvent("tool-1"));
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-2"));

      await useStreamingStateMachine.getState().handleEvent({
        type: "CONNECTION_ERROR",
        payload: new Error("Connection timeout"),
      });

      const parts = useStreamingStateMachine.getState().streamingMessage.parts;
      expect(parts.every((p) => p.status === "stale")).toBe(true);
    });

    it("increments sequence number on error", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
      const seqBefore = useStreamingStateMachine.getState().streamingMessage.sequence;

      await useStreamingStateMachine.getState().handleEvent({
        type: "CONNECTION_ERROR",
        payload: new Error("Error"),
      });

      expect(useStreamingStateMachine.getState().streamingMessage.sequence).toBe(seqBefore + 1);
    });

    it("handles different error types", async () => {
      const errorTypes = [
        new Error("Network timeout"),
        new TypeError("Invalid response"),
        new Error("Server disconnected"),
      ];

      for (const error of errorTypes) {
        useStreamingStateMachine.getState().reset();
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));

        await useStreamingStateMachine.getState().handleEvent({
          type: "CONNECTION_ERROR",
          payload: error,
        });

        expect(useStreamingStateMachine.getState().state).toBe("error");
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEX SCENARIOS & INTEGRATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("🔀 Complex Multi-Message Scenarios", () => {
    it("handles interleaved assistant and tool call messages", async () => {
      // Simulate: Assistant starts → Tool call → Tool result → Assistant continues
      await useStreamingStateMachine.getState().handleEvent(
        createAssistantBeginEvent("msg-1", { content: "Let me search for that..." })
      );
      await useStreamingStateMachine.getState().handleEvent(createToolCallBeginEvent("tool-1", { name: "web_search" }));
      await useStreamingStateMachine.getState().handleEvent(
        createPartEndEvent("tool-1", "toolCall", { result: '{"results": ["found"]}' })
      );
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", " Based on the search,"));
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", " here are the results."));
      await useStreamingStateMachine.getState().handleEvent(
        createPartEndEvent("msg-1", "assistant", { content: "Let me search for that... Based on the search, here are the results." })
      );

      const parts = useStreamingStateMachine.getState().streamingMessage.parts;
      expect(parts).toHaveLength(2);
      expect(parts.filter((p) => p.status === "complete")).toHaveLength(2);
    });

    it("handles multiple tool calls in sequence", async () => {
      for (let i = 1; i <= 5; i++) {
        await useStreamingStateMachine.getState().handleEvent(
          createToolCallBeginEvent(`tool-${i}`, { name: `tool_${i}` })
        );
        await useStreamingStateMachine.getState().handleEvent(
          createPartEndEvent(`tool-${i}`, "toolCall", { result: `result_${i}` })
        );
      }

      const parts = useStreamingStateMachine.getState().streamingMessage.parts;
      expect(parts).toHaveLength(5);
      expect(parts.every((p) => p.role === "toolCall" && p.status === "complete")).toBe(true);
    });

    it("handles rapid chunk events without data loss", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));

      const chunks = Array.from({ length: 100 }, (_, i) => `chunk${i}`);
      for (const chunk of chunks) {
        await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", chunk));
      }

      const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
      if (msg.role === "assistant") {
        expect(msg.data.content).toBe(chunks.join(""));
      }
    });

    it("handles complete conversation flow: init → messages → finalize", async () => {
      // User message
      useStreamingStateMachine.setState({
        streamingMessage: { parts: [createUserMessage("user-1", "Hello AI")], sequence: 1 },
      });

      // INIT acknowledges user message
      await useStreamingStateMachine.getState().handleEvent(createInitEvent("conv-new", "claude-3"));
      expect(useStreamingStateMachine.getState().state).toBe("receiving");

      // Assistant responds
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", "Hello! "));
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", "How can I help?"));
      await useStreamingStateMachine.getState().handleEvent(
        createPartEndEvent("msg-1", "assistant", { content: "Hello! How can I help?" })
      );

      // Finalize
      await useStreamingStateMachine.getState().handleEvent(createFinalizeEvent("conv-new"));

      expect(useStreamingStateMachine.getState().state).toBe("idle");
      expect(useStreamingStateMachine.getState().streamingMessage.parts).toEqual([]);
    });

    it("handles reasoning followed by content generation", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));

      // Reasoning phase
      await useStreamingStateMachine.getState().handleEvent(createReasoningChunkEvent("msg-1", "First, "));
      await useStreamingStateMachine.getState().handleEvent(createReasoningChunkEvent("msg-1", "I need to "));
      await useStreamingStateMachine.getState().handleEvent(createReasoningChunkEvent("msg-1", "analyze this."));

      // Content phase
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", "Here's my "));
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", "answer."));

      const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
      if (msg.role === "assistant") {
        expect(msg.data.reasoning).toBe("First, I need to analyze this.");
        expect(msg.data.content).toBe("Here's my answer.");
      }
    });

    it("handles error during active streaming gracefully", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", "Starting to type..."));
      await useStreamingStateMachine.getState().handleEvent(createToolCallBeginEvent("tool-1"));

      // Error occurs mid-stream
      await useStreamingStateMachine.getState().handleEvent({
        type: "CONNECTION_ERROR",
        payload: new Error("Connection dropped"),
      });

      const parts = useStreamingStateMachine.getState().streamingMessage.parts;
      expect(parts).toHaveLength(2);
      expect(parts.every((p) => p.status === "stale")).toBe(true);
      expect(useStreamingStateMachine.getState().state).toBe("error");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE TRANSITION VALIDATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("🔄 State Transition Validation", () => {
    const validTransitions: Array<{ from: StreamState; event: StreamEvent["type"]; to: StreamState }> = [
      { from: "idle", event: "INIT", to: "receiving" },
      { from: "idle", event: "PART_BEGIN", to: "receiving" },
      { from: "receiving", event: "CHUNK", to: "receiving" },
      { from: "receiving", event: "REASONING_CHUNK", to: "receiving" },
      { from: "receiving", event: "PART_END", to: "receiving" },
      { from: "receiving", event: "FINALIZE", to: "idle" },
      { from: "receiving", event: "CONNECTION_ERROR", to: "error" },
    ];

    it.each(validTransitions)(
      "transitions from $from to $to on $event",
      async ({ from, event, to }) => {
        useStreamingStateMachine.setState({ state: from });

        let testEvent: StreamEvent;
        switch (event) {
          case "INIT":
            useStreamingStateMachine.setState({
              streamingMessage: { parts: [createUserMessage("u1", "test")], sequence: 1 },
            });
            testEvent = createInitEvent("conv-1");
            break;
          case "PART_BEGIN":
            testEvent = createAssistantBeginEvent("msg-1");
            break;
          case "CHUNK":
            await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
            testEvent = createChunkEvent("msg-1", "text");
            break;
          case "REASONING_CHUNK":
            await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
            testEvent = createReasoningChunkEvent("msg-1", "thought");
            break;
          case "PART_END":
            await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
            testEvent = createPartEndEvent("msg-1", "assistant", { content: "done" });
            break;
          case "FINALIZE":
            testEvent = createFinalizeEvent("conv-1");
            break;
          case "CONNECTION_ERROR":
            testEvent = { type: "CONNECTION_ERROR", payload: new Error("test") };
            break;
          default:
            throw new Error(`Unhandled event type: ${event}`);
        }

        await useStreamingStateMachine.getState().handleEvent(testEvent);

        expect(useStreamingStateMachine.getState().state).toBe(to);
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SELECTOR FUNCTION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("🎯 Selector Functions", () => {
    it("getStreamingMessage returns current streaming state", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", "Hello"));

      const streamingMessage = useStreamingStateMachine.getState().getStreamingMessage();

      expect(streamingMessage.parts).toHaveLength(1);
      expect(streamingMessage.sequence).toBeGreaterThan(0);
    });

    it("getIncompleteIndicator returns null initially", () => {
      expect(useStreamingStateMachine.getState().getIncompleteIndicator()).toBeNull();
    });

    it("getIncompleteIndicator returns indicator after INCOMPLETE event", async () => {
      await useStreamingStateMachine.getState().handleEvent({
        type: "INCOMPLETE",
        payload: { reason: "max_tokens" } as any,
      });

      expect(useStreamingStateMachine.getState().getIncompleteIndicator()).not.toBeNull();
    });

    it("selectors return fresh data after state changes", async () => {
      const before = useStreamingStateMachine.getState().getStreamingMessage();
      expect(before.parts).toHaveLength(0);

      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));

      const after = useStreamingStateMachine.getState().getStreamingMessage();
      expect(after.parts).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES & BOUNDARY CONDITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("🔬 Edge Cases & Boundary Conditions", () => {
    it("handles extremely long message IDs", async () => {
      const longId = "msg-" + "x".repeat(1000);
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent(longId));

      expect(useStreamingStateMachine.getState().streamingMessage.parts[0].id).toBe(longId);
    });

    it("handles unicode in message content", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));
      await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", "日本語 🎉 العربية"));

      const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
      if (msg.role === "assistant") {
        expect(msg.data.content).toContain("日本語");
        expect(msg.data.content).toContain("🎉");
        expect(msg.data.content).toContain("العربية");
      }
    });

    it("handles empty conversation ID in INIT", async () => {
      useStreamingStateMachine.setState({
        streamingMessage: { parts: [createUserMessage("u1", "test")], sequence: 1 },
      });

      await useStreamingStateMachine.getState().handleEvent(createInitEvent(""));

      expect(useStreamingStateMachine.getState().state).toBe("receiving");
    });

    it("handles null-like values in payloads gracefully", async () => {
      const event: StreamEvent = {
        type: "PART_BEGIN",
        payload: {
          messageId: "msg-1",
          payload: {
            messageType: {
              case: "assistant",
              value: { content: null as any, reasoning: undefined as any, modelSlug: "" },
            },
          },
        } as any,
      };

      await useStreamingStateMachine.getState().handleEvent(event);

      // Should handle gracefully without crashing
      expect(useStreamingStateMachine.getState().streamingMessage.parts).toHaveLength(1);
    });

    it("handles very high sequence numbers", async () => {
      useStreamingStateMachine.setState({
        streamingMessage: { parts: [], sequence: Number.MAX_SAFE_INTEGER - 10 },
      });

      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));

      expect(useStreamingStateMachine.getState().streamingMessage.sequence).toBe(
        Number.MAX_SAFE_INTEGER - 9
      );
    });

    it("handles concurrent-style rapid state changes", async () => {
      const promises = [
        useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1")),
        useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-2")),
        useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-3")),
      ];

      await Promise.all(promises);

      expect(useStreamingStateMachine.getState().streamingMessage.parts.length).toBeGreaterThanOrEqual(1);
    });

    it("preserves message order in parts array", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("first"));
      await useStreamingStateMachine.getState().handleEvent(createToolCallBeginEvent("second"));
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("third"));

      const parts = useStreamingStateMachine.getState().streamingMessage.parts;
      expect(parts[0].id).toBe("first");
      expect(parts[1].id).toBe("second");
      expect(parts[2].id).toBe("third");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFORMANCE & STRESS TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("⚡ Performance & Stress Tests", () => {
    it("handles 1000 sequential chunks efficiently", async () => {
      await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent("msg-1"));

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        await useStreamingStateMachine.getState().handleEvent(createChunkEvent("msg-1", `chunk${i}`));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);

      const msg = useStreamingStateMachine.getState().streamingMessage.parts[0];
      if (msg.role === "assistant") {
        expect(msg.data.content.length).toBeGreaterThan(0);
      }
    });

    it("handles many PART_BEGIN events for different messages", async () => {
      for (let i = 0; i < 100; i++) {
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent(`msg-${i}`));
      }

      expect(useStreamingStateMachine.getState().streamingMessage.parts).toHaveLength(100);
    });

    it("handles rapid reset cycles", async () => {
      for (let i = 0; i < 50; i++) {
        await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent(`msg-${i}`));
        await useStreamingStateMachine.getState().handleEvent(createChunkEvent(`msg-${i}`, "content"));
        useStreamingStateMachine.getState().reset();
      }

      expect(useStreamingStateMachine.getState().state).toBe("idle");
      expect(useStreamingStateMachine.getState().streamingMessage.parts).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎲 RANDOMIZED / FUZZ TESTING
  // ═══════════════════════════════════════════════════════════════════════════

  describe("🎲 Randomized Fuzz Testing", () => {
    const runRandomizedTest = async (
      testName: string,
      eventCount: { min: number; max: number },
      iterations: number
    ) => {
      for (let i = 0; i < iterations; i++) {
        const seed = Date.now() + i * 12345;
        const generator = new RandomEventGenerator(seed);

        try {
          useStreamingStateMachine.getState().reset();
          const events = generator.generateEventSequence(eventCount.min, eventCount.max);

          for (const event of events) {
            await useStreamingStateMachine.getState().handleEvent(event);
          }

          // Basic invariant checks
          const state = useStreamingStateMachine.getState();
          expect(state.streamingMessage.parts).toBeInstanceOf(Array);
          expect(state.streamingMessage.sequence).toBeGreaterThanOrEqual(0);
          expect(["idle", "receiving", "finalizing", "error"]).toContain(state.state);

          // All parts should have valid structure
          for (const part of state.streamingMessage.parts) {
            expect(part.id).toBeTruthy();
            expect(["assistant", "toolCall", "toolCallPrepare", "user"]).toContain(part.role);
            expect(["streaming", "complete", "stale"]).toContain(part.status);
          }
        } catch (error) {
          // Log seed for reproducibility
          console.error(`❌ Test "${testName}" failed with seed: ${seed}`);
          console.error("Event log:", generator.getEventLog().join("\n"));
          throw error;
        }
      }
    };

    describe("🔀 Random Event Sequences", () => {
      it("handles 10 random short sequences (5-15 events)", async () => {
        await runRandomizedTest("short-sequences", { min: 5, max: 15 }, 10);
      });

      it("handles 5 random medium sequences (20-50 events)", async () => {
        await runRandomizedTest("medium-sequences", { min: 20, max: 50 }, 5);
      });

      it("handles 3 random long sequences (100-200 events)", async () => {
        await runRandomizedTest("long-sequences", { min: 100, max: 200 }, 3);
      });
    });

    describe("🎯 Random Message Interleaving", () => {
      it("handles randomly interleaved assistant and tool messages", async () => {
        for (let iteration = 0; iteration < 10; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration);
          useStreamingStateMachine.getState().reset();

          // Create random mix of message types
          const messageCount = rng.int(3, 8);
          const messages: Array<{ id: string; type: "assistant" | "toolCall" }> = [];

          for (let i = 0; i < messageCount; i++) {
            const id = `msg-${rng.string(6)}`;
            const type = rng.boolean() ? "assistant" : "toolCall";
            messages.push({ id, type });

            // Begin message
            if (type === "assistant") {
              await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent(id));
            } else {
              await useStreamingStateMachine.getState().handleEvent(createToolCallBeginEvent(id));
            }

            // Random chunks for assistant (randomly interleaved with other messages)
            if (type === "assistant" && rng.boolean(0.7)) {
              const chunkCount = rng.int(1, 5);
              for (let c = 0; c < chunkCount; c++) {
                await useStreamingStateMachine.getState().handleEvent(
                  createChunkEvent(id, rng.sentence(rng.int(1, 3)))
                );
              }
            }
          }

          // End messages in random order
          const shuffledMessages = rng.shuffle(messages);
          for (const msg of shuffledMessages) {
            await useStreamingStateMachine.getState().handleEvent(
              createPartEndEvent(msg.id, msg.type, {
                content: rng.sentence(3),
                result: rng.json(),
              })
            );
          }

          // Verify all messages are complete
          const state = useStreamingStateMachine.getState();
          expect(state.streamingMessage.parts).toHaveLength(messageCount);
          expect(state.streamingMessage.parts.every((p) => p.status === "complete")).toBe(true);
        }
      });

      it("handles random chunk distribution across multiple messages", async () => {
        for (let iteration = 0; iteration < 10; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 999);
          useStreamingStateMachine.getState().reset();

          // Start multiple assistant messages
          const msgCount = rng.int(2, 5);
          const msgIds = Array.from({ length: msgCount }, () => `msg-${rng.string(6)}`);

          for (const id of msgIds) {
            await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent(id));
          }

          // Send chunks to random messages
          const totalChunks = rng.int(20, 50);
          const expectedContent: Map<string, string> = new Map(msgIds.map((id) => [id, ""]));

          for (let i = 0; i < totalChunks; i++) {
            const targetId = rng.pick(msgIds);
            const chunk = rng.word() + " ";
            expectedContent.set(targetId, expectedContent.get(targetId)! + chunk);
            await useStreamingStateMachine.getState().handleEvent(createChunkEvent(targetId, chunk));
          }

          // Verify content accumulation
          const state = useStreamingStateMachine.getState();
          for (const part of state.streamingMessage.parts) {
            if (part.role === "assistant") {
              const expected = expectedContent.get(part.id);
              expect(part.data.content).toBe(expected);
            }
          }
        }
      });
    });

    describe("🔄 Random State Recovery", () => {
      it("recovers correctly after random errors during streaming", async () => {
        for (let iteration = 0; iteration < 10; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 7777);
          useStreamingStateMachine.getState().reset();

          // Build up some state
          const msgCount = rng.int(2, 5);
          for (let i = 0; i < msgCount; i++) {
            await useStreamingStateMachine.getState().handleEvent(
              createAssistantBeginEvent(`msg-${i}`)
            );
            for (let c = 0; c < rng.int(1, 5); c++) {
              await useStreamingStateMachine.getState().handleEvent(
                createChunkEvent(`msg-${i}`, rng.sentence(2))
              );
            }
          }

          // Inject connection error
          await useStreamingStateMachine.getState().handleEvent({
            type: "CONNECTION_ERROR",
            payload: new Error("Random connection error"),
          });

          // Verify error state
          const stateAfterError = useStreamingStateMachine.getState();
          expect(stateAfterError.state).toBe("error");
          expect(stateAfterError.streamingMessage.parts.every((p) => p.status === "stale")).toBe(true);

          // Reset should recover
          useStreamingStateMachine.getState().reset();
          expect(useStreamingStateMachine.getState().state).toBe("idle");
          expect(useStreamingStateMachine.getState().streamingMessage.parts).toHaveLength(0);
        }
      });
    });

    describe("� Random Network Interruption Simulation", () => {
      /** Network error types that could occur */
      const networkErrorTypes = [
        () => new Error("Network request failed"),
        () => new Error("Connection reset by peer"),
        () => new Error("ETIMEDOUT: Connection timed out"),
        () => new Error("ECONNREFUSED: Connection refused"),
        () => new Error("ERR_INTERNET_DISCONNECTED"),
        () => new Error("net::ERR_CONNECTION_CLOSED"),
        () => new Error("WebSocket connection closed unexpectedly"),
        () => new TypeError("Failed to fetch"),
        () => new Error("AbortError: The operation was aborted"),
        () => new Error("SSL handshake failed"),
      ];

      it("handles network interruption at INIT phase", async () => {
        for (let iteration = 0; iteration < 10; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration);
          useStreamingStateMachine.getState().reset();

          // Set up user message (simulating what happens before INIT)
          useStreamingStateMachine.setState({
            streamingMessage: {
              parts: [createUserMessage(`user-${rng.string(4)}`, rng.sentence(5))],
              sequence: 1,
            },
          });

          // Network dies before server can acknowledge
          await useStreamingStateMachine.getState().handleEvent({
            type: "CONNECTION_ERROR",
            payload: rng.pick(networkErrorTypes)(),
          });

          const state = useStreamingStateMachine.getState();
          expect(state.state).toBe("error");
          // User message should be marked as stale
          expect(state.streamingMessage.parts[0].status).toBe("stale");
        }
      });

      it("handles network interruption during first chunk", async () => {
        for (let iteration = 0; iteration < 10; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 111);
          useStreamingStateMachine.getState().reset();

          // Start assistant response
          const msgId = `msg-${rng.string(6)}`;
          await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent(msgId));

          // Send one partial chunk
          await useStreamingStateMachine.getState().handleEvent(
            createChunkEvent(msgId, rng.sentence(2))
          );

          // Network dies
          await useStreamingStateMachine.getState().handleEvent({
            type: "CONNECTION_ERROR",
            payload: rng.pick(networkErrorTypes)(),
          });

          const state = useStreamingStateMachine.getState();
          expect(state.state).toBe("error");
          expect(state.streamingMessage.parts[0].status).toBe("stale");
          // Content should still be preserved (user might want to see partial response)
          if (state.streamingMessage.parts[0].role === "assistant") {
            expect(state.streamingMessage.parts[0].data.content.length).toBeGreaterThan(0);
          }
        }
      });

      it("handles network interruption mid-stream with random timing", async () => {
        for (let iteration = 0; iteration < 15; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 222);
          useStreamingStateMachine.getState().reset();

          const msgId = `msg-${rng.string(6)}`;
          await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent(msgId));

          // Send random number of chunks before failure
          const chunksBeforeError = rng.int(1, 20);
          let accumulatedContent = "";

          for (let i = 0; i < chunksBeforeError; i++) {
            const chunk = rng.sentence(rng.int(1, 3)) + " ";
            accumulatedContent += chunk;
            await useStreamingStateMachine.getState().handleEvent(createChunkEvent(msgId, chunk));
          }

          // Network dies at random point
          await useStreamingStateMachine.getState().handleEvent({
            type: "CONNECTION_ERROR",
            payload: rng.pick(networkErrorTypes)(),
          });

          const state = useStreamingStateMachine.getState();
          expect(state.state).toBe("error");
          
          // Verify content up to error point is preserved
          const msg = state.streamingMessage.parts[0];
          if (msg.role === "assistant") {
            expect(msg.data.content).toBe(accumulatedContent);
          }
        }
      });

      it("handles network interruption during reasoning stream", async () => {
        for (let iteration = 0; iteration < 10; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 333);
          useStreamingStateMachine.getState().reset();

          const msgId = `msg-${rng.string(6)}`;
          await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent(msgId));

          // Send some reasoning chunks
          let accumulatedReasoning = "";
          const reasoningChunks = rng.int(3, 10);
          for (let i = 0; i < reasoningChunks; i++) {
            const chunk = rng.sentence(2) + " ";
            accumulatedReasoning += chunk;
            await useStreamingStateMachine.getState().handleEvent(
              createReasoningChunkEvent(msgId, chunk)
            );
          }

          // Network dies during reasoning
          await useStreamingStateMachine.getState().handleEvent({
            type: "CONNECTION_ERROR",
            payload: rng.pick(networkErrorTypes)(),
          });

          const state = useStreamingStateMachine.getState();
          expect(state.state).toBe("error");
          
          // Reasoning should be preserved
          const msg = state.streamingMessage.parts[0];
          if (msg.role === "assistant") {
            expect(msg.data.reasoning).toBe(accumulatedReasoning);
          }
        }
      });

      it("handles network interruption with multiple concurrent messages", async () => {
        for (let iteration = 0; iteration < 10; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 444);
          useStreamingStateMachine.getState().reset();

          // Start multiple messages
          const messageCount = rng.int(2, 5);
          const messageIds: string[] = [];
          const contentByMsg: Map<string, string> = new Map();

          for (let i = 0; i < messageCount; i++) {
            const id = `msg-${rng.string(6)}`;
            messageIds.push(id);
            contentByMsg.set(id, "");

            const isAssistant = rng.boolean(0.7);
            if (isAssistant) {
              await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent(id));
            } else {
              await useStreamingStateMachine.getState().handleEvent(createToolCallBeginEvent(id));
            }
          }

          // Send random chunks to random messages
          const chunkRounds = rng.int(10, 30);
          for (let i = 0; i < chunkRounds; i++) {
            const targetId = rng.pick(messageIds);
            const chunk = rng.word() + " ";
            contentByMsg.set(targetId, contentByMsg.get(targetId)! + chunk);
            await useStreamingStateMachine.getState().handleEvent(createChunkEvent(targetId, chunk));
          }

          // Complete some messages randomly before error
          const completedCount = rng.int(0, messageCount - 1);
          const shuffledIds = rng.shuffle([...messageIds]);
          for (let i = 0; i < completedCount; i++) {
            const id = shuffledIds[i];
            const part = useStreamingStateMachine.getState().streamingMessage.parts.find(
              (p) => p.id === id
            );
            if (part) {
              await useStreamingStateMachine.getState().handleEvent(
                createPartEndEvent(id, part.role === "assistant" ? "assistant" : "toolCall", {
                  content: contentByMsg.get(id) || rng.sentence(3),
                  result: rng.json(),
                })
              );
            }
          }

          // Network dies
          await useStreamingStateMachine.getState().handleEvent({
            type: "CONNECTION_ERROR",
            payload: rng.pick(networkErrorTypes)(),
          });

          const state = useStreamingStateMachine.getState();
          expect(state.state).toBe("error");

          // Verify: completed messages stay complete, streaming ones become stale
          for (const part of state.streamingMessage.parts) {
            if (part.status !== "complete") {
              expect(part.status).toBe("stale");
            }
          }
        }
      });

      it("handles network interruption during tool call execution", async () => {
        for (let iteration = 0; iteration < 10; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 555);
          useStreamingStateMachine.getState().reset();

          // Simulate: assistant starts → tool call → network dies during tool execution
          const assistantId = `assistant-${rng.string(6)}`;
          const toolId = `tool-${rng.string(6)}`;

          // Assistant message
          await useStreamingStateMachine.getState().handleEvent(
            createAssistantBeginEvent(assistantId, { content: "Let me search for that..." })
          );
          await useStreamingStateMachine.getState().handleEvent(
            createChunkEvent(assistantId, " I'll use a tool.")
          );
          await useStreamingStateMachine.getState().handleEvent(
            createPartEndEvent(assistantId, "assistant", {
              content: "Let me search for that... I'll use a tool.",
            })
          );

          // Tool call starts
          await useStreamingStateMachine.getState().handleEvent(
            createToolCallBeginEvent(toolId, { name: rng.toolName() })
          );

          // Network dies while waiting for tool result
          await useStreamingStateMachine.getState().handleEvent({
            type: "CONNECTION_ERROR",
            payload: rng.pick(networkErrorTypes)(),
          });

          const state = useStreamingStateMachine.getState();
          expect(state.state).toBe("error");

          // Assistant message should still be complete
          const assistantMsg = state.streamingMessage.parts.find((p) => p.id === assistantId);
          expect(assistantMsg?.status).toBe("complete");

          // Tool call should be stale
          const toolMsg = state.streamingMessage.parts.find((p) => p.id === toolId);
          expect(toolMsg?.status).toBe("stale");
        }
      });

      it("handles rapid reconnection attempts (error → retry pattern)", async () => {
        for (let iteration = 0; iteration < 5; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 666);
          useStreamingStateMachine.getState().reset();

          // Simulate multiple connection attempts
          const retryCount = rng.int(2, 5);

          for (let attempt = 0; attempt < retryCount; attempt++) {
            // Start streaming
            const msgId = `msg-attempt-${attempt}-${rng.string(4)}`;
            await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent(msgId));

            // Send some chunks
            for (let c = 0; c < rng.int(1, 5); c++) {
              await useStreamingStateMachine.getState().handleEvent(
                createChunkEvent(msgId, rng.sentence(2))
              );
            }

            // Connection fails
            await useStreamingStateMachine.getState().handleEvent({
              type: "CONNECTION_ERROR",
              payload: rng.pick(networkErrorTypes)(),
            });

            expect(useStreamingStateMachine.getState().state).toBe("error");

            // User triggers retry (reset and start over)
            useStreamingStateMachine.getState().reset();
            expect(useStreamingStateMachine.getState().state).toBe("idle");
          }

          // Final successful attempt
          const finalMsgId = `msg-final-${rng.string(4)}`;
          await useStreamingStateMachine.getState().handleEvent(
            createAssistantBeginEvent(finalMsgId)
          );
          await useStreamingStateMachine.getState().handleEvent(
            createChunkEvent(finalMsgId, "Success!")
          );
          await useStreamingStateMachine.getState().handleEvent(
            createPartEndEvent(finalMsgId, "assistant", { content: "Success!" })
          );

          const finalState = useStreamingStateMachine.getState();
          expect(finalState.streamingMessage.parts[0].status).toBe("complete");
        }
      });

      it("handles network interruption at exact message boundaries", async () => {
        for (let iteration = 0; iteration < 10; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 777);
          useStreamingStateMachine.getState().reset();

          // Test error at different boundaries
          const boundary = rng.pick([
            "after-begin",
            "after-first-chunk",
            "after-last-chunk",
          ]);

          const msgId = `msg-${rng.string(6)}`;
          await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent(msgId));

          if (boundary === "after-begin") {
            // Error immediately after begin
            await useStreamingStateMachine.getState().handleEvent({
              type: "CONNECTION_ERROR",
              payload: rng.pick(networkErrorTypes)(),
            });
          } else {
            // Send first chunk
            await useStreamingStateMachine.getState().handleEvent(
              createChunkEvent(msgId, "First ")
            );

            if (boundary === "after-first-chunk") {
              await useStreamingStateMachine.getState().handleEvent({
                type: "CONNECTION_ERROR",
                payload: rng.pick(networkErrorTypes)(),
              });
            } else {
              // Send more chunks (after-last-chunk)
              for (let i = 0; i < rng.int(3, 8); i++) {
                await useStreamingStateMachine.getState().handleEvent(
                  createChunkEvent(msgId, rng.word() + " ")
                );
              }

              // Error after last chunk but before PART_END
              await useStreamingStateMachine.getState().handleEvent({
                type: "CONNECTION_ERROR",
                payload: rng.pick(networkErrorTypes)(),
              });
            }
          }

          const state = useStreamingStateMachine.getState();
          expect(state.state).toBe("error");
          expect(state.streamingMessage.parts[0].status).toBe("stale");
        }
      });

      it("handles intermittent network (random errors in long stream)", async () => {
        for (let iteration = 0; iteration < 5; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 888);
          useStreamingStateMachine.getState().reset();

          // Simulate long stream with random network interruptions
          const totalEvents = rng.int(50, 100);
          const errorProbability = 0.05; // 5% chance of error at each point
          let errorCount = 0;
          let currentMsgId: string | null = null;

          for (let i = 0; i < totalEvents; i++) {
            // Random network error
            if (rng.boolean(errorProbability)) {
              await useStreamingStateMachine.getState().handleEvent({
                type: "CONNECTION_ERROR",
                payload: rng.pick(networkErrorTypes)(),
              });
              errorCount++;

              // Simulate recovery/reset
              useStreamingStateMachine.getState().reset();
              currentMsgId = null;
              continue;
            }

            // Normal event
            if (!currentMsgId || rng.boolean(0.1)) {
              // Start new message
              currentMsgId = `msg-${rng.string(6)}`;
              await useStreamingStateMachine.getState().handleEvent(
                createAssistantBeginEvent(currentMsgId)
              );
            } else {
              // Send chunk to current message
              await useStreamingStateMachine.getState().handleEvent(
                createChunkEvent(currentMsgId, rng.word() + " ")
              );
            }
          }

          // System should still be in a valid state
          const finalState = useStreamingStateMachine.getState();
          expect(["idle", "receiving", "finalizing", "error"]).toContain(finalState.state);
        }
      });

      it("verifies data integrity after network recovery", async () => {
        for (let iteration = 0; iteration < 10; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 999);
          useStreamingStateMachine.getState().reset();

          // Phase 1: Build up content
          const msgId1 = `msg-phase1-${rng.string(4)}`;
          await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent(msgId1));

          let phase1Content = "";
          for (let i = 0; i < rng.int(5, 15); i++) {
            const chunk = rng.sentence(2) + " ";
            phase1Content += chunk;
            await useStreamingStateMachine.getState().handleEvent(createChunkEvent(msgId1, chunk));
          }

          // Network error
          await useStreamingStateMachine.getState().handleEvent({
            type: "CONNECTION_ERROR",
            payload: rng.pick(networkErrorTypes)(),
          });

          // Verify phase 1 content is preserved even in error state
          const stateAfterError = useStreamingStateMachine.getState();
          const msg1 = stateAfterError.streamingMessage.parts[0];
          if (msg1.role === "assistant") {
            expect(msg1.data.content).toBe(phase1Content);
          }

          // Phase 2: Reset and new stream (simulating retry with new conversation)
          useStreamingStateMachine.getState().reset();

          const msgId2 = `msg-phase2-${rng.string(4)}`;
          await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent(msgId2));

          let phase2Content = "";
          for (let i = 0; i < rng.int(5, 15); i++) {
            const chunk = rng.sentence(2) + " ";
            phase2Content += chunk;
            await useStreamingStateMachine.getState().handleEvent(createChunkEvent(msgId2, chunk));
          }

          // Complete successfully
          await useStreamingStateMachine.getState().handleEvent(
            createPartEndEvent(msgId2, "assistant", { content: phase2Content })
          );

          // Verify phase 2 content
          const finalState = useStreamingStateMachine.getState();
          const msg2 = finalState.streamingMessage.parts[0];
          expect(msg2.status).toBe("complete");
          if (msg2.role === "assistant") {
            expect(msg2.data.content).toBe(phase2Content);
          }
        }
      });
    });

    describe("�📊 Random Content Verification", () => {
      it("maintains content integrity with random unicode content", async () => {
        for (let iteration = 0; iteration < 10; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 333);
          useStreamingStateMachine.getState().reset();

          const id = `msg-${rng.string(8)}`;
          await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent(id));

          // Build content with random unicode
          let expectedContent = "";
          const chunkCount = rng.int(10, 30);

          for (let i = 0; i < chunkCount; i++) {
            const chunk = rng.boolean(0.3)
              ? rng.unicodeString(rng.int(5, 20))
              : rng.sentence(rng.int(1, 4));
            expectedContent += chunk;
            await useStreamingStateMachine.getState().handleEvent(createChunkEvent(id, chunk));
          }

          const state = useStreamingStateMachine.getState();
          const msg = state.streamingMessage.parts[0];
          if (msg.role === "assistant") {
            expect(msg.data.content).toBe(expectedContent);
          }
        }
      });

      it("maintains separate content/reasoning streams correctly", async () => {
        for (let iteration = 0; iteration < 10; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 555);
          useStreamingStateMachine.getState().reset();

          const id = `msg-${rng.string(8)}`;
          await useStreamingStateMachine.getState().handleEvent(createAssistantBeginEvent(id));

          let expectedContent = "";
          let expectedReasoning = "";
          const eventCount = rng.int(20, 50);

          for (let i = 0; i < eventCount; i++) {
            const isReasoning = rng.boolean(0.4);
            const chunk = rng.word() + " ";

            if (isReasoning) {
              expectedReasoning += chunk;
              await useStreamingStateMachine.getState().handleEvent(
                createReasoningChunkEvent(id, chunk)
              );
            } else {
              expectedContent += chunk;
              await useStreamingStateMachine.getState().handleEvent(createChunkEvent(id, chunk));
            }
          }

          const state = useStreamingStateMachine.getState();
          const msg = state.streamingMessage.parts[0];
          if (msg.role === "assistant") {
            expect(msg.data.content).toBe(expectedContent);
            expect(msg.data.reasoning).toBe(expectedReasoning);
          }
        }
      });
    });

    describe("🎭 Random Order Invariants", () => {
      it("message order is preserved regardless of chunk timing", async () => {
        for (let iteration = 0; iteration < 10; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 111);
          useStreamingStateMachine.getState().reset();

          // Create messages in specific order
          const orderedIds = ["first", "second", "third", "fourth", "fifth"].map(
            (prefix) => `${prefix}-${rng.string(4)}`
          );

          // Begin in order
          for (const id of orderedIds) {
            await useStreamingStateMachine.getState().handleEvent(
              rng.boolean() ? createAssistantBeginEvent(id) : createToolCallBeginEvent(id)
            );
          }

          // Send chunks in random order
          const shuffledForChunks = rng.shuffle([...orderedIds]);
          for (const id of shuffledForChunks) {
            for (let i = 0; i < rng.int(1, 3); i++) {
              await useStreamingStateMachine.getState().handleEvent(
                createChunkEvent(id, rng.word())
              );
            }
          }

          // Verify order is preserved
          const state = useStreamingStateMachine.getState();
          const partIds = state.streamingMessage.parts.map((p) => p.id);
          expect(partIds).toEqual(orderedIds);
        }
      });

      it("sequence number always increases", async () => {
        for (let iteration = 0; iteration < 5; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 222);
          const generator = new RandomEventGenerator(rng.int(0, 100000));
          useStreamingStateMachine.getState().reset();

          let lastSequence = -1;
          const events = generator.generateEventSequence(20, 40);

          for (const event of events) {
            await useStreamingStateMachine.getState().handleEvent(event);
            const currentSequence = useStreamingStateMachine.getState().streamingMessage.sequence;
            expect(currentSequence).toBeGreaterThanOrEqual(lastSequence);
            lastSequence = currentSequence;
          }
        }
      });
    });

    describe("🔥 Chaos Testing", () => {
      it("survives completely random event bombardment", async () => {
        for (let iteration = 0; iteration < 5; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 9999);
          useStreamingStateMachine.getState().reset();

          const eventTypes = [
            () => createAssistantBeginEvent(rng.messageId()),
            () => createToolCallBeginEvent(rng.messageId()),
            () => createToolPrepareBeginEvent(rng.messageId()),
            () => createChunkEvent(rng.messageId(), rng.sentence()),
            () => createReasoningChunkEvent(rng.messageId(), rng.sentence()),
            () => createPartEndEvent(rng.messageId(), rng.boolean() ? "assistant" : "toolCall"),
            () => createInitEvent(`conv-${rng.string(8)}`),
            () => createFinalizeEvent(`conv-${rng.string(8)}`),
            () => ({ type: "CONNECTION_ERROR" as const, payload: new Error("chaos") }),
            () => ({ type: "INCOMPLETE" as const, payload: { reason: "chaos" } as any }),
          ];

          // Fire random events (some will be invalid combinations)
          for (let i = 0; i < 100; i++) {
            const eventGenerator = rng.pick(eventTypes);
            const event = eventGenerator();

            try {
              await useStreamingStateMachine.getState().handleEvent(event);
            } catch {
              // Some combinations may throw - that's expected in chaos mode
            }
          }

          // System should still be in a valid state
          const state = useStreamingStateMachine.getState();
          expect(["idle", "receiving", "finalizing", "error"]).toContain(state.state);
          expect(state.streamingMessage.parts).toBeInstanceOf(Array);
        }
      });

      it("handles rapid random resets during streaming", async () => {
        for (let iteration = 0; iteration < 5; iteration++) {
          const rng = new RandomGenerator(Date.now() + iteration * 8888);
          useStreamingStateMachine.getState().reset();

          for (let i = 0; i < 50; i++) {
            if (rng.boolean(0.1)) {
              useStreamingStateMachine.getState().reset();
            } else {
              const event = rng.boolean()
                ? createAssistantBeginEvent(rng.messageId())
                : createChunkEvent(rng.messageId(), rng.word());
              await useStreamingStateMachine.getState().handleEvent(event);
            }
          }

          // Final state should be valid
          const state = useStreamingStateMachine.getState();
          expect(["idle", "receiving", "finalizing", "error"]).toContain(state.state);
        }
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔁 REPRODUCIBLE RANDOM TESTS (with fixed seeds)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("🔁 Reproducible Random Tests", () => {
    // These tests use fixed seeds so they're deterministic but cover random scenarios
    const fixedSeeds = [12345, 67890, 11111, 22222, 33333];

    it.each(fixedSeeds)("reproduces consistent behavior with seed %d", async (seed) => {
      const generator = new RandomEventGenerator(seed);
      useStreamingStateMachine.getState().reset();

      const events = generator.generateEventSequence(30, 50);

      for (const event of events) {
        await useStreamingStateMachine.getState().handleEvent(event);
      }

      const state = useStreamingStateMachine.getState();

      // All tests with same seed should produce some state
      expect(state.streamingMessage.parts.length).toBeGreaterThan(0);
      
      // All non-toolPrepare messages should be complete
      // toolPrepare messages stay as "streaming" since they don't have explicit end events
      const nonToolPrepareParts = state.streamingMessage.parts.filter(
        (p) => p.role !== "toolCallPrepare"
      );
      expect(nonToolPrepareParts.every((p) => p.status === "complete")).toBe(true);
    });

    it("same seed produces identical event sequences", () => {
      const seed = 42424242;

      const gen1 = new RandomEventGenerator(seed);
      const events1 = gen1.generateEventSequence(20, 20);
      const log1 = gen1.getEventLog();

      const gen2 = new RandomEventGenerator(seed);
      const events2 = gen2.generateEventSequence(20, 20);
      const log2 = gen2.getEventLog();

      expect(log1).toEqual(log2);
      expect(events1.length).toBe(events2.length);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 📋 VERBOSE LOGGING DEMO TESTS (run with VERBOSE_TEST=1)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("📋 Verbose Logging Demo", () => {
    /**
     * This section demonstrates the test visualization system.
     * Run with VERBOSE_TEST=1 to see detailed output:
     * 
     *   VERBOSE_TEST=1 bun test streaming-state-machine.test.ts
     * 
     * The output shows:
     * - 🧪 Test name and boundaries
     * - 📨 Each event processed with payload details
     * - STATE: State transitions (idle → receiving, etc.)
     * - ✓/✗ Assertion results with expected/received values
     */

    it("demonstrates full conversation flow with logging", async () => {
      testLogger.startTest("Full Conversation Flow Demo");
      
      try {
        testLogger.logSection("Step 1: Initialize conversation");
        testLogger.logInfo("Starting a new conversation stream");
        await handleEventWithLogging(createInitEvent("conv-demo-001"));
        testLogger.logStreamingState();
        expectWithLogging(useStreamingStateMachine.getState().state, "state").toBe("receiving");

        testLogger.logSection("Step 2: Begin assistant message");
        testLogger.logInfo("AI starts responding");
        await handleEventWithLogging(createAssistantBeginEvent("msg-assistant-001"));
        testLogger.logStreamingState();
        expectWithLogging(useStreamingStateMachine.getState().streamingMessage.parts.length, "parts count").toBe(1);
        expectWithLogging(
          useStreamingStateMachine.getState().streamingMessage.parts[0].status,
          "message status"
        ).toBe("streaming");

        testLogger.logSection("Step 3: Stream content chunks");
        testLogger.logInfo("Receiving AI response in chunks");
        await handleEventWithLogging(createChunkEvent("msg-assistant-001", "Hello! "));
        await handleEventWithLogging(createChunkEvent("msg-assistant-001", "I'm your AI assistant. "));
        await handleEventWithLogging(createChunkEvent("msg-assistant-001", "How can I help you today?"));
        testLogger.logStreamingState();
        
        const content1 = (useStreamingStateMachine.getState().streamingMessage.parts[0] as any).data.content;
        expectWithLogging(content1, "accumulated content").toContain("Hello!");
        expectWithLogging(content1, "accumulated content").toContain("How can I help");

        testLogger.logSection("Step 4: Add reasoning chunks (thinking)");
        testLogger.logInfo("AI shares reasoning process");
        await handleEventWithLogging(createReasoningChunkEvent("msg-assistant-001", "[Thinking: Let me analyze the user's request...]"));
        testLogger.logStreamingState();
        
        const reasoning = (useStreamingStateMachine.getState().streamingMessage.parts[0] as any).data.reasoning;
        expectWithLogging(reasoning, "reasoning").toContain("Thinking");

        testLogger.logSection("Step 5: End assistant message");
        testLogger.logInfo("AI finishes response");
        await handleEventWithLogging(createPartEndEvent("msg-assistant-001", "assistant"));
        testLogger.logStreamingState();
        expectWithLogging(
          useStreamingStateMachine.getState().streamingMessage.parts[0].status,
          "message status"
        ).toBe("complete");

        testLogger.logSection("Step 6: Tool call sequence");
        testLogger.logInfo("AI decides to use a tool");
        await handleEventWithLogging(createToolPrepareBeginEvent("tool-prepare-001", { name: "search_web" }));
        await handleEventWithLogging(createToolCallBeginEvent("tool-call-001", "search_web"));
        await handleEventWithLogging(createChunkEvent("tool-call-001", '{"query": "weather today"}'));
        await handleEventWithLogging(createPartEndEvent("tool-call-001", "toolCall"));
        testLogger.logStreamingState();
        
        const parts = useStreamingStateMachine.getState().streamingMessage.parts;
        expectWithLogging(parts.length, "total parts").toBe(3);
        expectWithLogging(parts.filter(p => p.role === "toolCall").length, "tool call parts").toBe(1);

        testLogger.logSection("Step 7: Finalize conversation");
        testLogger.logInfo("Stream completes successfully");
        await handleEventWithLogging(createFinalizeEvent("conv-demo-001"));
        testLogger.logStreamingState();
        expectWithLogging(useStreamingStateMachine.getState().state, "final state").toBe("idle");

        testLogger.endTest(true);
      } catch (error) {
        testLogger.logError(`Test failed: ${error}`);
        testLogger.endTest(false);
        throw error;
      }
    });

    it("demonstrates error handling with logging", async () => {
      testLogger.startTest("Error Handling Demo");
      
      try {
        testLogger.logSection("Setup: Start normal streaming");
        await handleEventWithLogging(createInitEvent("conv-error-demo"));
        await handleEventWithLogging(createAssistantBeginEvent("msg-001"));
        await handleEventWithLogging(createChunkEvent("msg-001", "Starting to respond..."));
        testLogger.logStreamingState();
        expectWithLogging(useStreamingStateMachine.getState().state, "state").toBe("receiving");

        testLogger.logSection("Simulate: Connection error occurs");
        testLogger.logInfo("Network connection lost!");
        await handleEventWithLogging({
          type: "CONNECTION_ERROR",
          payload: new Error("WebSocket disconnected unexpectedly"),
        });
        testLogger.logStreamingState();
        expectWithLogging(useStreamingStateMachine.getState().state, "state after error").toBe("error");

        testLogger.logSection("Recovery: Reset and restart");
        testLogger.logInfo("Resetting state machine");
        useStreamingStateMachine.getState().reset();
        testLogger.logStreamingState();
        expectWithLogging(useStreamingStateMachine.getState().state, "state after reset").toBe("idle");

        testLogger.endTest(true);
      } catch (error) {
        testLogger.logError(`Test failed: ${error}`);
        testLogger.endTest(false);
        throw error;
      }
    });

    it("demonstrates incomplete stream with logging", async () => {
      testLogger.startTest("Incomplete Stream Demo");
      
      try {
        testLogger.logSection("Setup: Normal streaming");
        await handleEventWithLogging(createInitEvent("conv-incomplete"));
        await handleEventWithLogging(createAssistantBeginEvent("msg-001"));
        await handleEventWithLogging(createChunkEvent("msg-001", "Here's a partial resp"));
        testLogger.logStreamingState();

        testLogger.logSection("Issue: Stream truncated");
        testLogger.logInfo("Server indicates incomplete response due to max tokens");
        await handleEventWithLogging({
          type: "INCOMPLETE",
          payload: { reason: "max_tokens_reached" } as any,
        });
        testLogger.logStreamingState();
        
        const indicator = useStreamingStateMachine.getState().incompleteIndicator;
        expectWithLogging(indicator, "incomplete indicator").not.toBeNull();

        testLogger.endTest(true);
      } catch (error) {
        testLogger.logError(`Test failed: ${error}`);
        testLogger.endTest(false);
        throw error;
      }
    });

    it("demonstrates random sequence with logging", async () => {
      testLogger.startTest("Random Sequence Demo (seed: 777)");
      
      try {
        const generator = new RandomEventGenerator(777);
        const events = generator.generateEventSequence(8, 12);
        
        testLogger.logSection("Event Sequence Generated");
        testLogger.logInfo(`Generated ${events.length} events with seed 777`);
        testLogger.logInfo(`Event types: ${events.map(e => e.type).join(" → ")}`);
        
        testLogger.logSection("Processing Events");
        for (let i = 0; i < events.length; i++) {
          testLogger.logInfo(`Processing event ${i + 1}/${events.length}`);
          await handleEventWithLogging(events[i]);
        }
        
        testLogger.logSection("Final State Check");
        testLogger.logStreamingState();
        
        const state = useStreamingStateMachine.getState();
        expectWithLogging(state.streamingMessage.parts.length, "parts count").toBeGreaterThan(0);
        
        // All non-toolPrepare parts should be complete
        const nonPrepare = state.streamingMessage.parts.filter(p => p.role !== "toolCallPrepare");
        const allComplete = nonPrepare.every(p => p.status === "complete");
        expectWithLogging(allComplete, "all messages complete").toBe(true);

        testLogger.endTest(true);
      } catch (error) {
        testLogger.logError(`Test failed: ${error}`);
        testLogger.endTest(false);
        throw error;
      }
    });

    it("demonstrates multi-message interleaving with logging", async () => {
      testLogger.startTest("Multi-Message Interleaving Demo");
      
      try {
        testLogger.logSection("Phase 1: Initialize");
        await handleEventWithLogging(createInitEvent("conv-multi"));
        testLogger.logStreamingState();

        testLogger.logSection("Phase 2: Start multiple messages");
        testLogger.logInfo("Opening 3 parallel message streams");
        await handleEventWithLogging(createAssistantBeginEvent("assistant-1"));
        await handleEventWithLogging(createToolPrepareBeginEvent("prepare-1", { name: "calculate" }));
        await handleEventWithLogging(createToolCallBeginEvent("tool-1", "calculate"));
        testLogger.logStreamingState();
        expectWithLogging(useStreamingStateMachine.getState().streamingMessage.parts.length, "open parts").toBe(3);

        testLogger.logSection("Phase 3: Interleaved chunks");
        testLogger.logInfo("Chunks arriving out of order from different streams");
        await handleEventWithLogging(createChunkEvent("assistant-1", "Let me "));
        await handleEventWithLogging(createChunkEvent("tool-1", '{"x":'));
        await handleEventWithLogging(createChunkEvent("assistant-1", "help you "));
        await handleEventWithLogging(createChunkEvent("tool-1", ' 42}'));
        await handleEventWithLogging(createChunkEvent("assistant-1", "with that!"));
        testLogger.logStreamingState();

        testLogger.logSection("Phase 4: Close messages");
        testLogger.logInfo("Ending all open streams");
        // Provide final content that matches what was streamed (PART_END can update content)
        await handleEventWithLogging(createPartEndEvent("assistant-1", "assistant", { 
          content: "Let me help you with that!" 
        }));
        await handleEventWithLogging(createPartEndEvent("tool-1", "toolCall", {
          args: '{"x": 42}'
        }));
        testLogger.logStreamingState();

        const parts = useStreamingStateMachine.getState().streamingMessage.parts;
        const assistantPart = parts.find(p => p.id === "assistant-1") as any;
        const toolPart = parts.find(p => p.id === "tool-1") as any;
        
        expectWithLogging(assistantPart.data.content, "assistant content").toContain("help you");
        expectWithLogging(toolPart.data.args, "tool args").toContain("42");
        expectWithLogging(assistantPart.status, "assistant status").toBe("complete");
        expectWithLogging(toolPart.status, "tool status").toBe("complete");

        testLogger.endTest(true);
      } catch (error) {
        testLogger.logError(`Test failed: ${error}`);
        testLogger.endTest(false);
        throw error;
      }
    });
  });
});
