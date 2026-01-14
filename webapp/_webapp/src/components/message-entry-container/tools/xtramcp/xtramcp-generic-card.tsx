import { cn } from "@heroui/react";
import { LoadingIndicator } from "../../../loading-indicator";
import MarkdownComponent from "../../../markdown";
import { useState } from "react";
import { XtraMcpToolCardProps, parseXtraMcpToolResult, CollapseArrowButton, CollapseWrapper } from "./utils/common";

export const XtraMcpGenericCard = ({ functionName, message, preparing, animated }: XtraMcpToolCardProps) => {
  const [isMetadataCollapsed, setIsMetadataCollapsed] = useState(false);

  // Loading state (tool executing)
  if (preparing) {
    return (
      <div className={cn("tool-card", { animated: animated })}>
        <div className="flex items-center justify-between">
          <h3 className="tool-card-title">Calling {functionName}</h3>
        </div>
        <LoadingIndicator text="Processing ..." estimatedSeconds={100} />
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

  // Verbatim mode - display pre-formatted content
  if (result.display_mode === "verbatim" && typeof result.content === "string") {
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
                {/* Generic metadata rendering - display all fields */}
                {Object.entries(result.metadata).map(([key, value], index) => {
                  const isLastItem = index === Object.entries(result.metadata!).length - 1;

                  // Format value based on type
                  let formattedValue;
                  if (typeof value === "object") {
                    formattedValue = JSON.stringify(value);
                  } else if (typeof value === "string") {
                    // Check if it's a file path (contains a dot extension)
                    const isFilePath =
                      value.includes(".") &&
                      (value.endsWith(".bib") ||
                        value.endsWith(".tex") ||
                        value.endsWith(".pdf") ||
                        value.includes("/"));

                    if (isFilePath) {
                      formattedValue = (
                        <code className="px-1 py-0.5 bg-gray-100 rounded text-gray-700 font-mono text-xs">{value}</code>
                      );
                    } else {
                      formattedValue = `"${value}"`;
                    }
                  } else {
                    formattedValue = String(value);
                  }

                  return (
                    <div key={key} className={isLastItem ? "" : "mb-2"}>
                      <span className="font-medium">{key}:</span> {formattedValue}
                    </div>
                  );
                })}
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

  // Interpret mode - minimal display (LLM will format in response)
  if (result.display_mode === "interpret") {
    return (
      <div className={cn("tool-card noselect narrow", { animated: animated })}>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsMetadataCollapsed(!isMetadataCollapsed)}
        >
          <h3 className="tool-card-title">{functionName}</h3>
        </div>

        {/* Show metadata in interpret mode */}
        {!isMetadataCollapsed && result.metadata && Object.keys(result.metadata).length > 0 && (
          <div className="text-xs text-gray-600 mt-1">
            {Object.entries(result.metadata).map(([key, value]) => (
              <span key={key} className="mr-2">
                {key}: {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </span>
            ))}
          </div>
        )}
      </div>
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
