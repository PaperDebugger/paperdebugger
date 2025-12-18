import { cn } from "@heroui/react";
import { LoadingIndicator } from "../loading-indicator";

export const ToolCallPrepareMessageContainer = ({ functionName, stale, preparing }: { functionName: string; stale: boolean; preparing: boolean }) => {
  // When preparing, show minimal UI with just the text
  if (preparing && !stale) {
    return (
      <div className="chat-message-entry">
        <span className="text-sm text-gray-400 loading-shimmer" style={{
          WebkitTextFillColor: "transparent",
          animationDelay: "0.5s",
          animationDuration: "3s",
          animationIterationCount: "infinite",
          animationName: "shimmer",
          background: "#cdcdcd -webkit-gradient(linear, 100% 0, 0 0, from(#cdcdcd), color-stop(.5, #1a1a1a), to(#cdcdcd))",
          WebkitBackgroundClip: "text",
          backgroundRepeat: "no-repeat",
          backgroundSize: "50% 200%",
          backgroundPositionX: "-100%",
        }}>
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
