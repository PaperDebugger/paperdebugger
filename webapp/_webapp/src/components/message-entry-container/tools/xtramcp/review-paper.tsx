import { cn } from "@heroui/react";
import { LoadingIndicator } from "@/components/loading-indicator";
import MarkdownComponent from "@/components/markdown";
import { useState } from "react";
import { XtraMcpToolCardProps, parseXtraMcpToolResult, CollapseArrowButton, CollapseWrapper } from "./utils/common";

// Component to render severity levels with strikethrough
const SeverityLevels = ({ threshold }: { threshold: string }) => {
  const levels = ["nit", "minor", "major", "blocker"];
  const thresholdIndex = levels.indexOf(threshold.toLowerCase());

  return (
    <div className="inline-flex items-center gap-1 flex-wrap">
      {levels.map((level, index) => (
        <span key={level}>
          <code
            className={cn(
              "text-xs px-1.5 py-0.5 rounded",
              index < thresholdIndex
                ? "line-through text-gray-400 dark:text-default-500 bg-gray-100 dark:!bg-default-200"
                : "text-gray-700 dark:text-default-200 bg-gray-100 dark:!bg-default-200",
            )}
          >
            {level}
          </code>
          {index < levels.length - 1 && <span className="text-gray-400 mx-1">|</span>}
        </span>
      ))}
    </div>
  );
};

const Sections = ({ sections }: { sections: Array<string> }) => {
  return (
    <span>
      {sections.map((section, index) => (
        <span key={section}>
          <code className="text-xs px-1.5 py-0.5 rounded text-gray-700 dark:text-default-200 bg-gray-100 dark:!bg-default-200">
            {section}
          </code>
          {index < sections.length - 1 && ", "}
        </span>
      ))}
    </span>
  );
};

export const ReviewPaperCard = ({ functionName, message, preparing, animated }: XtraMcpToolCardProps) => {
  const [isMetadataCollapsed, setIsMetadataCollapsed] = useState(false);

  // Loading state (tool executing)
  if (preparing) {
    return (
      <div className={cn("tool-card", { animated: animated })}>
        <div className="flex items-center justify-between">
          <h3 className="tool-card-title">Reviewing your work..</h3>
        </div>
        <LoadingIndicator text="Processing ..." estimatedSeconds={80} />
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
          role="button"
          tabIndex={0}
          onClick={() => setIsMetadataCollapsed(!isMetadataCollapsed)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setIsMetadataCollapsed(!isMetadataCollapsed);
            }
          }}
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
            role="button"
            tabIndex={0}
            onClick={() => setIsMetadataCollapsed(!isMetadataCollapsed)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setIsMetadataCollapsed(!isMetadataCollapsed);
              }
            }}
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
              <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200!">
                {/* Informational note */}
                <div className="mb-2 text-gray-600">
                  <MarkdownComponent animated={animated}>
                    ℹ️ Review paper is currently scaled back to balance cost. Presently it identifies issues in Title,
                    Abstract, and Introduction. We are working to support the full review flow again.
                  </MarkdownComponent>
                </div>

                {/* Custom metadata rendering */}
                {result.metadata.target_venue !== undefined && (
                  <div className="mb-2">
                    <span className="font-medium">Checked for:</span> "
                    {result.metadata.target_venue || "General review"}"
                  </div>
                )}
                {result.metadata.severity_threshold && (
                  <div className="mb-2">
                    <span className="font-medium">Filtered:</span>{" "}
                    <SeverityLevels threshold={result.metadata.severity_threshold} />
                  </div>
                )}
                {result.metadata.sections_reviewed && (
                  <div>
                    <span className="font-medium">Sections reviewed:</span>{" "}
                    <Sections sections={result.metadata.sections_reviewed} />
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
