// libs/withRetrySync.ts

import { errorToast } from "./toasts";
import { logError } from "./logger";
import { ErrorCode, Error as RequestError } from "../pkg/gen/apiclient/shared/v1/shared_pb";

export async function withRetrySync<T>(
  operation: () => Promise<T>,
  options: {
    sync: () => Promise<void>;
    onGiveUp?: () => void;
  },
): Promise<T | undefined> {
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
