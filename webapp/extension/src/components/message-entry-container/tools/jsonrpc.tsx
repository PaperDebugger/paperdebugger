import { cn } from "@heroui/react";
import { JsonRpcResult } from "./utils/common";
import MarkdownComponent from "../../markdown";
import { LoadingIndicator } from "../../loading-indicator";
import { useState } from "react";

type JsonRpcProps = {
  functionName: string;
  jsonRpcResult: JsonRpcResult;
  preparing: boolean;
  animated: boolean;
};

export const JsonRpc = ({ functionName, jsonRpcResult, preparing, animated }: JsonRpcProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (preparing) {
    return (
      <div className={cn("tool-card", { animated: animated })}>
        <div className="flex items-center justify-between">
          <h3 className="tool-card-title tool-card-jsonrpc">{functionName}</h3>
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
        <h3 className="tool-card-title tool-card-jsonrpc">{functionName}</h3>
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
              {jsonRpcResult.result.content?.map((content) => content.text).join("\n") || ""}
            </MarkdownComponent>
          </div>
        )}

        {jsonRpcResult.error && <div className="text-xs text-red-600">{jsonRpcResult.error.message}</div>}
      </div>
    </div>
  );
};
