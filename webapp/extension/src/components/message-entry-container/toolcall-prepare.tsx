import { cn } from "@heroui/react";
import { LoadingIndicator } from "../loading-indicator";

export const ToolCallPrepareMessageContainer = ({ stale, preparing }: { stale: boolean; preparing: boolean }) => {
  return (
    <div className="chat-message-entry">
      <div className={cn("indicator", preparing || stale ? "preparing" : "prepared")}>
        <LoadingIndicator
          text={`Preparing function ...`}
          errorMessage={stale ? "Prepare function failed, please reload this conversation." : undefined}
        />
      </div>
    </div>
  );
};
