import { cn } from "@heroui/react";
import { LoadingIndicator } from "../loading-indicator";

export const ToolCallPrepareMessageContainer = ({ functionName, stale, preparing }: { functionName: string; stale: boolean; preparing: boolean }) => {
  return (
    <div className="chat-message-entry">
      <div className={cn("indicator", preparing || stale ? "preparing" : "prepared")}>
        <LoadingIndicator
          text={`Preparing function ${functionName} ...`}
          errorMessage={stale ? "Prepare function failed, please reload this conversation." : undefined}
        />
      </div>
    </div>
  );
};
