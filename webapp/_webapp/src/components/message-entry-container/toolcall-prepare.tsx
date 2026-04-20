import { cn } from "@heroui/react";
import { LoadingIndicator } from "../loading-indicator";

export const ToolCallPrepareMessageContainer = ({
  functionName,
  stale,
  preparing,
}: {
  functionName: string;
  stale: boolean;
  preparing: boolean;
}) => {
  // When preparing, show minimal UI with just the text
  if (preparing && !stale) {
    return (
      <div className="chat-message-entry">
        <span
          className="text-xs pl-2 text-gray-400 shimmer">
          Preparing function {functionName}...
        </span>
      </div>
    );
  }

  // When prepared or stale, show the full indicator
  return (
    <div className="chat-message-entry">
      <div className={cn("indicator", stale ? "preparing" : "prepared")}>
        <LoadingIndicator
          text={`Preparing function ${functionName}...`}
          errorMessage={stale ? "Prepare function failed, please reload this conversation." : undefined}
        />
      </div>
    </div>
  );
};
