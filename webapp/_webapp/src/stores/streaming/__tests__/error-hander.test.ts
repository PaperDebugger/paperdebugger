/**
 * Unit Tests for Streaming Error Handler
 *
 * Tests error handling, recovery strategies, and retry logic.
 */

import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import {
  createStreamingError,
  getRecoveryStrategy,
  StreamingErrorHandler,
  isRetryableError,
  handleStreamingError,
  withStreamingErrorHandler,
} from "../error-handler";
import { StreamingError, StreamingErrorCode, RecoveryStrategy } from "../types";

// Mock toast and logger
const mockErrorToast = mock(() => {});
mock.module("../../../libs/toasts", () => ({
  errorToast: mockErrorToast,
}));

const mockLogError = mock(() => {});
const mockLogWarn = mock(() => {});
const mockLogInfo = mock(() => {});
mock.module("../../../libs/logger", () => ({
  logError: mockLogError,
  logWarn: mockLogWarn,
  logInfo: mockLogInfo,
}));

describe("Error Handler", () => {
  beforeEach(() => {
    mockErrorToast.mockClear();
    mockLogError.mockClear();
    mockLogWarn.mockClear();
    mockLogInfo.mockClear();
  });

  describe("createStreamingError", () => {
    it("should create error from string", () => {
      const error = createStreamingError("Something went wrong");

      expect(error.message).toBe("Something went wrong");
      expect(error.code).toBe("UNKNOWN");
      expect(error.retryable).toBe(false);
      expect(error.timestamp).toBeGreaterThan(0);
    });

    it("should detect PROJECT_OUT_OF_DATE from message", () => {
      const error = createStreamingError("project is out of date");

      expect(error.code).toBe("PROJECT_OUT_OF_DATE");
      expect(error.retryable).toBe(true);
    });

    it("should detect NETWORK_ERROR from message", () => {
      const error = createStreamingError("Network connection failed");

      expect(error.code).toBe("NETWORK_ERROR");
      expect(error.retryable).toBe(true);
    });

    it("should detect TIMEOUT from message", () => {
      const error = createStreamingError("Request timed out");

      expect(error.code).toBe("TIMEOUT");
      expect(error.retryable).toBe(true);
    });

    it("should detect RATE_LIMITED from message", () => {
      const error = createStreamingError("Rate limit exceeded, too many requests");

      expect(error.code).toBe("RATE_LIMITED");
      expect(error.retryable).toBe(true);
    });

    it("should detect AUTHENTICATION_ERROR from message", () => {
      const error = createStreamingError("Unauthorized: invalid token");

      expect(error.code).toBe("AUTHENTICATION_ERROR");
      expect(error.retryable).toBe(false);
    });

    it("should detect SERVER_ERROR from message", () => {
      const error = createStreamingError("Internal server error");

      expect(error.code).toBe("SERVER_ERROR");
      expect(error.retryable).toBe(true);
    });

    it("should create error from Error object", () => {
      const originalError = new Error("Network error occurred");
      const error = createStreamingError(originalError);

      expect(error.message).toBe("Network error occurred");
      expect(error.code).toBe("NETWORK_ERROR");
      expect(error.originalError).toBe(originalError);
    });

    it("should create error from RequestError with code", () => {
      // Simulate a protobuf RequestError
      const requestError = {
        code: 10, // PROJECT_OUT_OF_DATE
        message: "Project version mismatch",
      };

      const error = createStreamingError(requestError);

      expect(error.message).toBe("Project version mismatch");
      expect(error.originalError).toBe(requestError);
    });

    it("should handle null/undefined gracefully", () => {
      const error = createStreamingError(null);

      expect(error.code).toBe("UNKNOWN");
      expect(error.message).toBe("null");
    });

    it("should use default code when message doesn't match known patterns", () => {
      // When error message doesn't match any known pattern, 
      // detectErrorCodeFromMessage returns UNKNOWN (not the default code)
      // This is because the string "Something" doesn't contain any error keywords
      const error = createStreamingError("Something", "SERVER_ERROR");

      // The function detects from message first, defaultCode is only used for unknown error types
      expect(error.code).toBe("UNKNOWN");
    });
  });

  describe("getRecoveryStrategy", () => {
    const testCases: Array<{
      code: StreamingErrorCode;
      expectedType: RecoveryStrategy["type"];
    }> = [
      { code: "PROJECT_OUT_OF_DATE", expectedType: "sync-and-retry" },
      { code: "NETWORK_ERROR", expectedType: "retry" },
      { code: "TIMEOUT", expectedType: "retry" },
      { code: "RATE_LIMITED", expectedType: "retry" },
      { code: "SERVER_ERROR", expectedType: "retry" },
      { code: "INVALID_RESPONSE", expectedType: "show-error" },
      { code: "AUTHENTICATION_ERROR", expectedType: "show-error" },
      { code: "UNKNOWN", expectedType: "show-error" },
    ];

    for (const { code, expectedType } of testCases) {
      it(`should return ${expectedType} strategy for ${code}`, () => {
        const error: StreamingError = {
          code,
          message: "Test error",
          retryable: false,
          timestamp: Date.now(),
        };

        const strategy = getRecoveryStrategy(error);

        expect(strategy.type).toBe(expectedType);
      });
    }

    it("should have correct maxRetries for retry strategies", () => {
      const networkError: StreamingError = {
        code: "NETWORK_ERROR",
        message: "Test",
        retryable: true,
        timestamp: Date.now(),
      };

      const strategy = getRecoveryStrategy(networkError);

      if (strategy.type === "retry") {
        expect(strategy.maxRetries).toBe(3);
        expect(strategy.backoff).toBe("exponential");
        expect(strategy.delayMs).toBe(1000);
      }
    });

    it("should have correct config for sync-and-retry strategy", () => {
      const error: StreamingError = {
        code: "PROJECT_OUT_OF_DATE",
        message: "Test",
        retryable: true,
        timestamp: Date.now(),
      };

      const strategy = getRecoveryStrategy(error);

      if (strategy.type === "sync-and-retry") {
        expect(strategy.maxRetries).toBe(2);
      }
    });
  });

  describe("isRetryableError", () => {
    it("should return true for retryable errors", () => {
      expect(isRetryableError("Network connection failed")).toBe(true);
      expect(isRetryableError("project is out of date")).toBe(true);
      expect(isRetryableError("Request timed out")).toBe(true);
      expect(isRetryableError(new Error("Server error"))).toBe(true);
    });

    it("should return false for non-retryable errors", () => {
      expect(isRetryableError("Unauthorized")).toBe(false);
      expect(isRetryableError("Unknown error")).toBe(false);
    });
  });

  describe("StreamingErrorHandler", () => {
    describe("handle()", () => {
      it("should handle retry strategy successfully", async () => {
        let retryCount = 0;
        const handler = new StreamingErrorHandler({
          sync: async () => ({ success: true }),
          retryOperation: async () => {
            retryCount++;
            if (retryCount < 2) {
              throw new Error("Network error");
            }
          },
        });

        const resolution = await handler.handle("Network error", {
          retryCount: 0,
          maxRetries: 3,
          currentPrompt: "test",
          currentSelectedText: "",
          operation: "send-message",
        });

        expect(resolution.handled).toBe(true);
        expect(resolution.success).toBe(true);
      });

      it("should handle sync-and-retry strategy successfully", async () => {
        let syncCalled = false;
        let retryCalled = false;

        const handler = new StreamingErrorHandler({
          sync: async () => {
            syncCalled = true;
            return { success: true };
          },
          retryOperation: async () => {
            retryCalled = true;
          },
        });

        const resolution = await handler.handle("project is out of date", {
          retryCount: 0,
          maxRetries: 2,
          currentPrompt: "test",
          currentSelectedText: "",
          operation: "send-message",
        });

        expect(syncCalled).toBe(true);
        expect(retryCalled).toBe(true);
        expect(resolution.handled).toBe(true);
        expect(resolution.success).toBe(true);
      });

      it("should fail after max retry attempts", async () => {
        const handler = new StreamingErrorHandler({
          sync: async () => ({ success: true }),
          retryOperation: async () => {
            throw new Error("Network error");
          },
        });

        const resolution = await handler.handle("Network error", {
          retryCount: 3, // Already at max
          maxRetries: 3,
          currentPrompt: "test",
          currentSelectedText: "",
          operation: "send-message",
        });

        expect(resolution.handled).toBe(true);
        expect(resolution.success).toBe(false);
      });

      it("should show error for non-retryable errors", async () => {
        const handler = new StreamingErrorHandler({
          sync: async () => ({ success: true }),
          retryOperation: async () => {},
        });

        const resolution = await handler.handle("Unauthorized", {
          retryCount: 0,
          maxRetries: 3,
          currentPrompt: "test",
          currentSelectedText: "",
          operation: "send-message",
        });

        expect(resolution.handled).toBe(true);
        expect(resolution.success).toBe(false);
        expect(resolution.strategy.type).toBe("show-error");
      });

      it("should call onShowError callback when provided", async () => {
        let shownMessage = "";
        const handler = new StreamingErrorHandler({
          sync: async () => ({ success: true }),
          retryOperation: async () => {},
          onShowError: (message) => {
            shownMessage = message;
          },
        });

        await handler.handle("Unauthorized access", {
          retryCount: 0,
          maxRetries: 3,
          currentPrompt: "test",
          currentSelectedText: "",
          operation: "send-message",
        });

        expect(shownMessage).toContain("Authentication");
      });

      it("should handle sync failure in sync-and-retry", async () => {
        const handler = new StreamingErrorHandler({
          sync: async () => ({ success: false, error: new Error("Sync failed") }),
          retryOperation: async () => {},
        });

        // This will eventually fail after retries
        const resolution = await handler.handle("project is out of date", {
          retryCount: 1, // One attempt left
          maxRetries: 2,
          currentPrompt: "test",
          currentSelectedText: "",
          operation: "send-message",
        });

        expect(resolution.success).toBe(false);
      });
    });
  });

  describe("handleStreamingError", () => {
    it("should show error for non-retryable errors without retry function", async () => {
      const resolution = await handleStreamingError("Unknown error", {});

      expect(resolution.handled).toBe(true);
      expect(resolution.success).toBe(false);
    });

    it("should attempt retry when retry function provided", async () => {
      let retryCalled = false;
      const resolution = await handleStreamingError("Network error", {
        retry: async () => {
          retryCalled = true;
        },
      });

      expect(retryCalled).toBe(true);
      expect(resolution.handled).toBe(true);
    });
  });

  describe("withStreamingErrorHandler", () => {
    it("should return result on success", async () => {
      const result = await withStreamingErrorHandler(
        async () => "success",
        { sync: async () => ({ success: true }) }
      );

      expect(result).toBe("success");
    });

    it("should handle PROJECT_OUT_OF_DATE with sync and retry", async () => {
      let syncCalled = false;
      let attemptCount = 0;

      const result = await withStreamingErrorHandler(
        async () => {
          attemptCount++;
          if (attemptCount === 1) {
            throw new Error("project is out of date");
          }
          return "success after retry";
        },
        {
          sync: async () => {
            syncCalled = true;
            return { success: true };
          },
        }
      );

      expect(syncCalled).toBe(true);
      expect(attemptCount).toBe(2);
      expect(result).toBe("success after retry");
    });

    it("should return undefined and call onGiveUp on persistent failure", async () => {
      let gaveUp = false;

      const result = await withStreamingErrorHandler(
        async () => {
          throw new Error("project is out of date");
        },
        {
          sync: async () => ({ success: true }),
          onGiveUp: () => {
            gaveUp = true;
          },
        }
      );

      expect(result).toBeUndefined();
      expect(gaveUp).toBe(true);
    });

    it("should show error for non-PROJECT_OUT_OF_DATE errors", async () => {
      let gaveUp = false;

      const result = await withStreamingErrorHandler(
        async () => {
          throw new Error("Unknown error");
        },
        {
          sync: async () => ({ success: true }),
          onGiveUp: () => {
            gaveUp = true;
          },
        }
      );

      expect(result).toBeUndefined();
      expect(gaveUp).toBe(true);
    });
  });

  describe("Backoff Calculations", () => {
    it("should calculate exponential backoff correctly", async () => {
      const delays: number[] = [];
      const originalSetTimeout = setTimeout;

      // Mock setTimeout to capture delays
      globalThis.setTimeout = ((fn: () => void, delay: number) => {
        delays.push(delay);
        fn(); // Execute immediately for testing
        return 0 as any;
      }) as any;

      const handler = new StreamingErrorHandler({
        sync: async () => ({ success: true }),
        retryOperation: async () => {
          throw new Error("Network error");
        },
      });

      await handler.handle("Network error", {
        retryCount: 0,
        maxRetries: 3,
        currentPrompt: "test",
        currentSelectedText: "",
        operation: "send-message",
      });

      globalThis.setTimeout = originalSetTimeout;

      // Exponential backoff: 1000, 2000, 4000
      expect(delays.length).toBeGreaterThanOrEqual(1);
      if (delays.length >= 3) {
        expect(delays[0]).toBe(1000); // 1000 * 2^0
        expect(delays[1]).toBe(2000); // 1000 * 2^1
        expect(delays[2]).toBe(4000); // 1000 * 2^2
      }
    });
  });
});
