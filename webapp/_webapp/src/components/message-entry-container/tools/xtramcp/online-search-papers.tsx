import { cn } from "@heroui/react";
import { LoadingIndicator } from "../../../loading-indicator";
import MarkdownComponent from "../../../markdown";
import { useState } from "react";
import { XtraMcpToolCardProps, parseXtraMcpToolResult } from "./utils/common";

export const OnlineSearchPapersCard = ({ functionName, message, preparing, animated }: XtraMcpToolCardProps) => {
  const [isMetadataCollapsed, setIsMetadataCollapsed] = useState(false);

  // Loading state (tool executing)
  if (preparing) {
    return (
      <div className={cn("tool-card", { animated: animated })}>
        <div className="flex items-center justify-between">
          <h3 className="tool-card-title">Searching online..</h3>
        </div>
        <LoadingIndicator text="Processing ..." estimatedSeconds={180} />
      </div>
    );
  }

  // Parse XtraMCP ToolResult format
  const result = parseXtraMcpToolResult(message);

  // No result or not ToolResult format - minimal display
  if (!result) {
    return (
      <div className={cn("tool-card noselect narrow", { animated: animated })}>
        <div className="flex items-center justify-between">
          <h3 className="tool-card-title">{functionName}</h3>
        </div>
      </div>
    );
  }

  // Error state
  if (result.error || result.success === false) {
    return (
      <div className={cn("tool-card noselect narrow", { animated: animated })}>
        {/* Header with Error label and arrow button */}
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsMetadataCollapsed(!isMetadataCollapsed)}>
          <h3 className="tool-card-title">{functionName}</h3>
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-sm font-medium">Error</span>
            {/* Arrow button - controls error dropdown */}
            <button
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded"
              aria-label={isMetadataCollapsed ? "Expand error" : "Collapse error"}
            >
              <svg
                className={cn("w-4 h-4 transition-transform duration-200", {
                  "rotate-180": !isMetadataCollapsed,
                })}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error message dropdown */}
        <div
          className={cn("overflow-hidden transition-all duration-300 ease-in-out", {
            "max-h-0 opacity-0": isMetadataCollapsed,
            "max-h-[500px] opacity-100": !isMetadataCollapsed,
          })}
        >
          <div className="text-xs text-red-600 mt-2 pt-2 border-t border-red-200">
            {result.error || "Tool execution failed"}
          </div>
        </div>
      </div>
    );
  }

  // Success state - verbatim mode (guaranteed for this tool on success)
  // Display compact card + content below
  if (typeof result.content === "string") {
    return (
      <>
        {/* COMPACT TOOL CARD - Just title + metadata dropdown */}
        <div className={cn("tool-card noselect narrow", { animated: animated })}>
          {/* Header with arrow button */}
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsMetadataCollapsed(!isMetadataCollapsed)}>
            <h3 className="tool-card-title">{functionName}</h3>
            {/* Arrow button - controls metadata dropdown */}
            <button
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded"
              aria-label={isMetadataCollapsed ? "Expand metadata" : "Collapse metadata"}
            >
              <svg
                className={cn("w-4 h-4 transition-transform duration-200", {
                  "rotate-180": !isMetadataCollapsed,
                })}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Metadata dropdown - INSIDE the tool card */}
          {result.metadata && Object.keys(result.metadata).length > 0 && (
            <div
              className={cn("overflow-hidden transition-all duration-300 ease-in-out", {
                "max-h-0 opacity-0": isMetadataCollapsed,
                "max-h-[500px] opacity-100": !isMetadataCollapsed,
              })}
            >
              <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
                {/* Custom metadata rendering */}
                {result.metadata.query && (
                  <div className="mb-2">
                    <span className="font-medium">Query Used:</span> "{result.metadata.query}"
                  </div>
                )}
                {result.metadata.total_count !== undefined && (
                  <div>
                    <span className="font-medium">Total Found:</span> {result.metadata.total_count}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* CONTENT - OUTSIDE/BELOW the tool card, always visible */}
        <div className="canselect text-sm mt-2">
          <MarkdownComponent animated={animated}>
            {result.content}
          </MarkdownComponent>
        </div>
      </>
    );
  }

  // Fallback - unknown format
  return (
    <div className={cn("tool-card noselect narrow", { animated: animated })}>
      <div className="flex items-center justify-between">
        <h3 className="tool-card-title">{functionName}</h3>
      </div>
    </div>
  );
};
