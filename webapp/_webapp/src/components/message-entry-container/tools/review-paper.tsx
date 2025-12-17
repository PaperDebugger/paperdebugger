import { cn } from "@heroui/react";
import { JsonRpcResult } from "./utils/common";
import { LoadingIndicator } from "../../loading-indicator";
import MarkdownComponent from "../../markdown";
import { useState } from "react";

type ReviewPaperProps = {
  jsonRpcResult: JsonRpcResult;
  preparing: boolean;
  animated: boolean;
};

export const ReviewPaperCard = ({ jsonRpcResult, preparing, animated }: ReviewPaperProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (preparing) {
    return (
      <div className={cn("tool-card", { animated: animated })}>
        <div className="flex items-center justify-between">
          <h3 className="tool-card-title tool-card-jsonrpc">Reviewing Paper</h3>
        </div>
        <LoadingIndicator text="Processing ..." estimatedSeconds={300} />
      </div>
    );
  }

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={cn("tool-card noselect narrow", { animated: animated })}>
      <div className="flex items-center justify-between cursor-pointer" onClick={toggleCollapse}>
        <h3 className="tool-card-title tool-card-jsonrpc">review_paper</h3>
        <button
          className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded"
          aria-label={isCollapsed ? "Expand" : "Collapse"}
        >
          <svg
            className={cn("w-4 h-4 transition-transform duration-200", {
              "rotate-180": !isCollapsed,
            })}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div
        className={cn("canselect overflow-hidden transition-all duration-300 ease-in-out", {
          "max-h-0 opacity-0": isCollapsed,
          "max-h-[1000px] opacity-100": !isCollapsed,
        })}
      >
        {jsonRpcResult.result && (
          <div className="text-xs">
            <MarkdownComponent animated={animated}>
              ℹ️ Review paper is currently scaled back to balance cost. Presently it identifies issues in Title,
              Abstract, and Introduction. We are working to support the full review flow again. If you find the input
              might not be properly passed, try highlighting the relevant sections and adding to chat.
            </MarkdownComponent>
          </div>
        )}

        {jsonRpcResult.error && <div className="text-xs text-red-600">{jsonRpcResult.error.message}</div>}
      </div>
    </div>
  );
};
