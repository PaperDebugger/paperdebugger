/**
 * Streaming Error Handler
 *
 * Centralized error handling for all streaming-related errors.
 * Provides a unified strategy for error recovery, retry logic, and user notification.
 *
 * Benefits:
 * - Single source of truth for error handling logic
 * - Configurable recovery strategies per error type
 * - Eliminates duplicate retry logic across files
 * - Testable error handling with explicit strategies
 */

import { ErrorCode, Error as RequestError } from "../../pkg/gen/apiclient/shared/v1/shared_pb";
import { logError, logWarn, logInfo } from "../../libs/logger";
import { errorToast } from "../../libs/toasts";
import {
  StreamingError,
  StreamingErrorCode,
  RecoveryStrategy,
  ErrorContext,
  ErrorResolution,
} from "./types";

// ============================================================================
// Error Code Mapping
// ============================================================================

/**
 * Maps protobuf ErrorCode to our StreamingErrorCode.
 */
function mapErrorCode(code?: ErrorCode): StreamingErrorCode {
  if (code === undefined) return "UNKNOWN";

  switch (code) {
    case ErrorCode.PROJECT_OUT_OF_DATE:
      return "PROJECT_OUT_OF_DATE";
    case ErrorCode.INVALID_TOKEN:
    case ErrorCode.INVALID_ACTOR:
    case ErrorCode.INVALID_CREDENTIAL:
      return "AUTHENTICATION_ERROR";
    case ErrorCode.PERMISSION_DENIED:
      return "AUTHENTICATION_ERROR";
    case ErrorCode.BAD_REQUEST:
    case ErrorCode.INVALID_LLM_RESPONSE:
      return "INVALID_RESPONSE";
    case ErrorCode.INTERNAL:
      return "SERVER_ERROR";
    case ErrorCode.RECORD_NOT_FOUND:
    case ErrorCode.INVALID_USER:
      return "INVALID_RESPONSE";
    default:
      return "UNKNOWN";
  }
}

/**
 * Creates a StreamingError from various error sources.
 */
export function createStreamingError(
  error: Error | RequestError | string | unknown,
  defaultCode: StreamingErrorCode = "UNKNOWN"
): StreamingError {
  const timestamp = Date.now();

  // Handle string errors
  if (typeof error === "string") {
    const code = detectErrorCodeFromMessage(error);
    return {
      code,
      message: error,
      retryable: isRetryableCode(code),
      timestamp,
    };
  }

  // Handle RequestError from protobuf
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    const requestError = error as RequestError;
    const code = mapErrorCode(requestError.code);
    return {
      code,
      message: requestError.message,
      originalError: error,
      retryable: isRetryableCode(code),
      timestamp,
    };
  }

  // Handle standard Error
  if (error instanceof Error) {
    const code = detectErrorCodeFromMessage(error.message);
    return {
      code,
      message: error.message,
      originalError: error,
      retryable: isRetryableCode(code),
      timestamp,
    };
  }

  // Fallback for unknown error types
  return {
    code: defaultCode,
    message: String(error) || "An unknown error occurred",
    originalError: error,
    retryable: isRetryableCode(defaultCode),
    timestamp,
  };
}

/**
 * Detects error code from error message content.
 */
function detectErrorCodeFromMessage(message: string): StreamingErrorCode {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("project is out of date") || lowerMessage.includes("out of date")) {
    return "PROJECT_OUT_OF_DATE";
  }
  if (lowerMessage.includes("network") || lowerMessage.includes("connection") || lowerMessage.includes("fetch")) {
    return "NETWORK_ERROR";
  }
  if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
    return "TIMEOUT";
  }
  if (lowerMessage.includes("rate limit") || lowerMessage.includes("too many requests")) {
    return "RATE_LIMITED";
  }
  if (lowerMessage.includes("unauthorized") || lowerMessage.includes("authentication") || lowerMessage.includes("token")) {
    return "AUTHENTICATION_ERROR";
  }
  if (lowerMessage.includes("server error") || lowerMessage.includes("internal")) {
    return "SERVER_ERROR";
  }

  return "UNKNOWN";
}

/**
 * Determines if an error code is retryable.
 */
function isRetryableCode(code: StreamingErrorCode): boolean {
  switch (code) {
    case "PROJECT_OUT_OF_DATE":
    case "NETWORK_ERROR":
    case "TIMEOUT":
    case "SERVER_ERROR":
      return true;
    case "RATE_LIMITED":
      return true; // Retryable with backoff
    case "INVALID_RESPONSE":
    case "AUTHENTICATION_ERROR":
    case "UNKNOWN":
      return false;
  }
}

// ============================================================================
// Recovery Strategy Configuration
// ============================================================================

/**
 * Default recovery strategies per error code.
 */
const DEFAULT_STRATEGIES: Record<StreamingErrorCode, RecoveryStrategy> = {
  PROJECT_OUT_OF_DATE: {
    type: "sync-and-retry",
    maxRetries: 3,
  },
  NETWORK_ERROR: {
    type: "retry",
    maxRetries: 3,
    backoff: "exponential",
    delayMs: 1000,
  },
  TIMEOUT: {
    type: "retry",
    maxRetries: 2,
    backoff: "linear",
    delayMs: 2000,
  },
  RATE_LIMITED: {
    type: "retry",
    maxRetries: 3,
    backoff: "exponential",
    delayMs: 5000,
  },
  SERVER_ERROR: {
    type: "retry",
    maxRetries: 2,
    backoff: "exponential",
    delayMs: 2000,
  },
  INVALID_RESPONSE: {
    type: "show-error",
    dismissable: true,
    message: "Received an invalid response. Please try again.",
  },
  AUTHENTICATION_ERROR: {
    type: "show-error",
    dismissable: false,
    message: "Authentication failed. Please sign in again.",
  },
  UNKNOWN: {
    type: "show-error",
    dismissable: true,
  },
};

/**
 * Gets the recovery strategy for a given error.
 */
export function getRecoveryStrategy(error: StreamingError): RecoveryStrategy {
  return DEFAULT_STRATEGIES[error.code];
}

// ============================================================================
// Streaming Error Handler Class
// ============================================================================

/**
 * Handles and synchronizes the stream of errors.
 */
export interface StreamingErrorHandlerDeps {
  /** Sync function to synchronize project state */
  sync: () => Promise<{ success: boolean; error?: Error }>;
  /** Function to retry the failed operation */
  retryOperation: () => Promise<void>;
  /** Callback when error handling completes */
  onComplete?: (resolution: ErrorResolution) => void;
  /** Callback when an error message should be displayed */
  onShowError?: (message: string, title?: string) => void;
}

/**
 * StreamingErrorHandler - Centralized error handling for streaming operations.
 *
 * Usage:
 * ```typescript
 * const handler = new StreamingErrorHandler({
 *   sync: () => syncProject(),
 *   retryOperation: () => sendMessage(prompt, selectedText),
 * });
 *
 * try {
 *   await sendMessage(prompt, selectedText);
 * } catch (error) {
 *   const resolution = await handler.handle(error, {
 *     retryCount: 0,
 *     maxRetries: 3,
 *     currentPrompt: prompt,
 *     currentSelectedText: selectedText,
 *     operation: "send-message",
 *   });
 *   if (!resolution.success) {
 *     // Handle final failure
 *   }
 * }
 * ```
 */
export class StreamingErrorHandler {
  private deps: StreamingErrorHandlerDeps;

  constructor(deps: StreamingErrorHandlerDeps) {
    this.deps = deps;
  }

  /**
   * Handles a streaming error with appropriate recovery strategy.
   */
  async handle(
    error: Error | RequestError | string | unknown,
    context: ErrorContext
  ): Promise<ErrorResolution> {
    const streamingError = createStreamingError(error);
    const strategy = getRecoveryStrategy(streamingError);

    logError(`Streaming error [${streamingError.code}] ${strategy.type}:`, streamingError.message, context);

    switch (strategy.type) {
      case "retry":
        return this.handleRetry(streamingError, context, strategy);

      case "sync-and-retry":
        return this.handleSyncAndRetry(streamingError, context, strategy);

      case "show-error":
        return this.handleShowError(streamingError, strategy);

      case "abort":
        return this.handleAbort(streamingError, strategy);

      default: {
        // Exhaustive check
        const _exhaustive: never = strategy;
        logError("Unknown recovery strategy:", _exhaustive);
        return {
          handled: false,
          success: false,
          strategy,
          message: "Unknown recovery strategy",
        };
      }
    }
  }

  /**
   * Handle simple retry with backoff.
   */
  private async handleRetry(
    error: StreamingError,
    context: ErrorContext,
    strategy: Extract<RecoveryStrategy, { type: "retry" }>
  ): Promise<ErrorResolution> {
    // Increment retry count at the beginning
    const currentAttempt = context.retryCount + 1;

    if (currentAttempt > strategy.maxRetries) {
      logWarn(`Max retry attempts (${strategy.maxRetries}) reached for ${error.code}`);
      this.showErrorToUser(error, "Retry failed after multiple attempts");
      return {
        handled: true,
        success: false,
        strategy,
        message: `Max retries exceeded for ${error.code}`,
      };
    }

    const delay = this.calculateDelay(context.retryCount, strategy);
    logInfo(`Retrying in ${delay}ms (attempt ${currentAttempt}/${strategy.maxRetries})`);

    await this.sleep(delay);

    try {
      await this.deps.retryOperation();
      return {
        handled: true,
        success: true,
        strategy,
        message: `Retry successful on attempt ${currentAttempt}`,
      };
    } catch (retryError) {
      // Recursive retry with incremented count
      return this.handle(retryError, {
        ...context,
        retryCount: currentAttempt,
      });
    }
  }

  /**
   * Handle sync-then-retry for project out of date errors.
   */
  private async handleSyncAndRetry(
    error: StreamingError,
    context: ErrorContext,
    strategy: Extract<RecoveryStrategy, { type: "sync-and-retry" }>
  ): Promise<ErrorResolution> {
    // Increment retry count at the beginning
    const currentAttempt = context.retryCount + 1;
    console.log("handleSyncAndRetry called, currentAttempt:", currentAttempt);
    if (currentAttempt > strategy.maxRetries) {
      logWarn(`Max sync-and-retry attempts (${strategy.maxRetries}) reached`);
      this.showErrorToUser(error, "Project sync failed");
      return {
        handled: true,
        success: false,
        strategy,
        message: "Max sync-and-retry attempts exceeded",
      };
    }

    logInfo(`Syncing project before retry (attempt ${currentAttempt}/${strategy.maxRetries})`);

    try {
      const syncResult = await this.deps.sync();
      if (!syncResult.success) {
        throw syncResult.error || new Error("Sync failed");
      }

      await this.deps.retryOperation();
      return {
        handled: true,
        success: true,
        strategy,
        message: "Sync and retry successful",
      };
    } catch (retryError) {
      // Recursive retry with incremented count
      return this.handle(retryError, {
        ...context,
        retryCount: currentAttempt,
      });
    }
  }

  /**
   * Handle show error to user.
   */
  private handleShowError(
    error: StreamingError,
    strategy: Extract<RecoveryStrategy, { type: "show-error" }>
  ): ErrorResolution {
    const message = strategy.message || error.message;
    this.showErrorToUser(error, message);

    return {
      handled: true,
      success: false,
      strategy,
      message,
    };
  }

  /**
   * Handle abort - stop processing and optionally cleanup.
   */
  private handleAbort(
    error: StreamingError,
    strategy: Extract<RecoveryStrategy, { type: "abort" }>
  ): ErrorResolution {
    logError("Aborting due to error:", error.message);

    return {
      handled: true,
      success: false,
      strategy,
      message: `Operation aborted: ${error.message}`,
    };
  }

  /**
   * Shows error to user via toast.
   */
  private showErrorToUser(error: StreamingError, message: string): void {
    if (this.deps.onShowError) {
      this.deps.onShowError(message, getErrorTitle(error.code));
    } else {
      errorToast(message, getErrorTitle(error.code));
    }
  }

  /**
   * Calculate delay based on retry strategy.
   */
  private calculateDelay(
    retryCount: number,
    strategy: Extract<RecoveryStrategy, { type: "retry" }>
  ): number {
    if (strategy.backoff === "exponential") {
      // Exponential backoff: delay * 2^retryCount
      return strategy.delayMs * Math.pow(2, retryCount);
    }
    // Linear backoff: delay * (retryCount + 1)
    return strategy.delayMs * (retryCount + 1);
  }

  /**
   * Sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a user-friendly error title based on error code.
 */
function getErrorTitle(code: StreamingErrorCode): string {
  switch (code) {
    case "PROJECT_OUT_OF_DATE":
      return "Project Out of Date";
    case "NETWORK_ERROR":
      return "Network Error";
    case "TIMEOUT":
      return "Request Timeout";
    case "RATE_LIMITED":
      return "Rate Limited";
    case "INVALID_RESPONSE":
      return "Invalid Response";
    case "AUTHENTICATION_ERROR":
      return "Authentication Error";
    case "SERVER_ERROR":
      return "Server Error";
    case "UNKNOWN":
      return "Error";
  }
}

/**
 * Quick helper to check if an error is retryable.
 */
export function isRetryableError(error: Error | RequestError | string | unknown): boolean {
  const streamingError = createStreamingError(error);
  return streamingError.retryable;
}

/**
 * Quick helper to handle an error with default behavior.
 * Use this for simple error handling without creating a full handler instance.
 */
export async function handleStreamingError(
  error: Error | RequestError | string | unknown,
  options: {
    sync?: () => Promise<{ success: boolean; error?: Error }>;
    retry?: () => Promise<void>;
    context?: Partial<ErrorContext>;
  }
): Promise<ErrorResolution> {
  const currentAttempt = options.context?.retryCount || 0;
  const streamingError = createStreamingError(error);
  const strategy = getRecoveryStrategy(streamingError);

  // If not retryable or no retry function, just show the error
  if (!streamingError.retryable || (!options.retry && !options.sync)) {
    errorToast(streamingError.message, getErrorTitle(streamingError.code));
    return {
      handled: true,
      success: false,
      strategy,
      message: streamingError.message,
    };
  }

  // Create handler and delegate
  const handler = new StreamingErrorHandler({
    sync: options.sync || (async () => ({ success: true })),
    retryOperation: options.retry || (async () => {}),
  });

  return handler.handle(error, {
    retryCount: currentAttempt,
    maxRetries: 3,
    currentPrompt: "",
    currentSelectedText: "",
    operation: "other",
    ...options.context,
  });
}

/**
 * Wrap an async operation with automatic error handling.
 * This is a replacement for withRetrySync that uses the new error handler.
 */
export async function withStreamingErrorHandler<T>(
  operation: () => Promise<T>,
  options: {
    sync: () => Promise<{ success: boolean; error?: Error }>;
    onGiveUp?: () => void;
    context?: Partial<ErrorContext>;
  }
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    const streamingError = createStreamingError(error);
    const strategy = getRecoveryStrategy(streamingError);

    // Handle sync-and-retry for project out of date
    if (streamingError.code === "PROJECT_OUT_OF_DATE") {
      try {
        logInfo("Project out of date, syncing and retrying...");
        const syncResult = await options.sync();
        if (!syncResult.success) {
          throw syncResult.error || new Error("Sync failed");
        }
        return await operation();
      } catch (retryError) {
        errorToast("Retry failed", "Operation failed after retry");
        logError("Retry after sync failed:", retryError);
        options.onGiveUp?.();
        return undefined;
      }
    }

    // Handle other errors
    const message = (strategy.type === "show-error" && strategy.message) || streamingError.message;
    errorToast(message, getErrorTitle(streamingError.code));
    logError("Operation failed:", error);
    options.onGiveUp?.();
    return undefined;
  }
}
