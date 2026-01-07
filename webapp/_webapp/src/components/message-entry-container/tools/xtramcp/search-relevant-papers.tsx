import { cn } from "@heroui/react";
import { LoadingIndicator } from "../../../loading-indicator";
import MarkdownComponent from "../../../markdown";
import { useState } from "react";
import { XtraMcpToolCardProps, parseXtraMcpToolResult, CollapseArrowButton, CollapseWrapper } from "./utils/common";

// Helper function to format time
const formatTime = (time: unknown): string => {
  if (typeof time === "number") {
    return `${time.toFixed(2)}s`;
  }
  return String(time);
};

export const SearchRelevantPapersCard = ({ functionName, message, preparing, animated }: XtraMcpToolCardProps) => {
  const [isMetadataCollapsed, setIsMetadataCollapsed] = useState(false);

  // Loading state (tool executing)
  if (preparing) {
    return (
      <div className={cn("tool-card", { animated: animated })}>
        <div className="flex items-center justify-between">
          <h3 className="tool-card-title">Searching for papers..</h3>
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
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsMetadataCollapsed(!isMetadataCollapsed)}
        >
          <h3 className="tool-card-title">{functionName}</h3>
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-sm font-medium">Error</span>
            <CollapseArrowButton
              isCollapsed={isMetadataCollapsed}
              ariaLabel={isMetadataCollapsed ? "Expand error" : "Collapse error"}
            />
          </div>
        </div>

        {/* Error message dropdown */}
        <CollapseWrapper isCollapsed={isMetadataCollapsed}>
          <div className="text-xs text-red-600 mt-2 pt-2 border-t border-red-200">
            {result.error || "Tool execution failed"}
          </div>
        </CollapseWrapper>
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
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsMetadataCollapsed(!isMetadataCollapsed)}
          >
            <h3 className="tool-card-title">{functionName}</h3>
            <CollapseArrowButton
              isCollapsed={isMetadataCollapsed}
              ariaLabel={isMetadataCollapsed ? "Expand metadata" : "Collapse metadata"}
            />
          </div>

          {/* Metadata dropdown - INSIDE the tool card */}
          {result.metadata && Object.keys(result.metadata).length > 0 && (
            <CollapseWrapper isCollapsed={isMetadataCollapsed}>
              <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
                {/* Custom metadata rendering */}
                {result.metadata.query && (
                  <div className="mb-2">
                    <span className="font-medium">Query Used:</span> "{result.metadata.query}"
                  </div>
                )}
                {result.metadata.search_time !== undefined && (
                  <div className="mb-2">
                    <span className="font-medium">Time Taken:</span> {formatTime(result.metadata.search_time)}
                  </div>
                )}
                {result.metadata.total_count !== undefined && (
                  <div>
                    <span className="font-medium">Total Results:</span> {result.metadata.total_count}
                  </div>
                )}
              </div>
            </CollapseWrapper>
          )}
        </div>

        {/* CONTENT - OUTSIDE/BELOW the tool card, always visible */}
        <div className="canselect text-sm mt-2">
          <MarkdownComponent animated={animated}>{result.content}</MarkdownComponent>
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
