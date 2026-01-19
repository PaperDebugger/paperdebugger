// libs/withRetrySync.ts

/**
 * @deprecated Use `withStreamingErrorHandler` from `stores/streaming/error-handler.ts` instead.
 * This function is kept for backward compatibility but will be removed in a future version.
 *
 * The new error handler provides:
 * - Centralized error handling logic
 * - Configurable recovery strategies per error type
 * - Better error categorization
 * - Exponential/linear backoff support
 *
 * Migration:
 * ```typescript
 * // Before
 * import { withRetrySync } from "../libs/with-retry-sync";
 * await withRetrySync(operation, { sync, onGiveUp });
 *
 * // After
 * import { withStreamingErrorHandler } from "../stores/streaming";
 * await withStreamingErrorHandler(operation, { sync, onGiveUp });
 * ```
 */

import { errorToast } from "./toasts";
import { logError, logWarn } from "./logger";
import { ErrorCode, Error as RequestError } from "../pkg/gen/apiclient/shared/v1/shared_pb";

/**
 * @deprecated Use `withStreamingErrorHandler` from `stores/streaming/error-handler.ts` instead.
 */
export async function withRetrySync<T>(
  operation: () => Promise<T>,
  options: {
    sync: () => Promise<void>;
    onGiveUp?: () => void;
  },
): Promise<T | undefined> {
  logWarn("withRetrySync is deprecated. Use withStreamingErrorHandler instead.");

  try {
    return await operation();
  } catch (e) {
    const error = e as RequestError | undefined;
    const { sync, onGiveUp } = options;

    if (error?.code === ErrorCode.PROJECT_OUT_OF_DATE) {
      try {
        await sync();
        return await operation(); // retry once
      } catch (retryError) {
        errorToast("Retry failed", "Operation failed after retry");
        logError("Retry after sync failed:", retryError);
        onGiveUp?.();
      }
    } else {
      errorToast(error?.message ?? "unknown", "Operation Error");
      logError("Operation failed:", error);
      onGiveUp?.();
    }
    return undefined;
  }
}
