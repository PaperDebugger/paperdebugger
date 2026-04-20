import { cn } from "@heroui/react";
import { useEffect, useState, useRef } from "react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { mermaid } from "@streamdown/mermaid";
import { math } from "@streamdown/math";
import { cjk } from "@streamdown/cjk";

type GeneralToolCardProps = {
  functionName: string;
  message: string;
  animated: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isLoading?: boolean;
};

export const GeneralToolCard = ({
  functionName,
  message,
  animated,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse,
  isLoading,
}: GeneralToolCardProps) => {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Use external state if provided, otherwise use internal state
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;

  // Sync internal state with external state when it changes
  useEffect(() => {
    if (externalIsCollapsed !== undefined) {
      setInternalIsCollapsed(externalIsCollapsed);
    }
  }, [externalIsCollapsed]);

  // Auto-scroll to bottom when message updates and is loading
  useEffect(() => {
    if (isLoading && scrollContainerRef.current && !isCollapsed) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [message, isLoading, isCollapsed]);

  // Auto-collapse when loading finishes (reasoning ends)
  const prevIsLoadingRef = useRef(isLoading);
  useEffect(() => {
    // Only collapse if it was loading before and now it's not
    if (prevIsLoadingRef.current && !isLoading) {
      if (onToggleCollapse && externalIsCollapsed === false) {
        onToggleCollapse();
      } else if (externalIsCollapsed === undefined) {
        setInternalIsCollapsed(true);
      }
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading, onToggleCollapse, externalIsCollapsed]);

  // When no message, show minimal "Calling tool..." style like Preparing function
  if (!message) {
    return (
      <div className="chat-message-entry">
        <span className="text-sm text-gray-400 shimmer">
          Calling tool {functionName}...
        </span>
      </div>
    );
  }

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalIsCollapsed(!internalIsCollapsed);
    }
  };
  const pascalCase = (str: string) => {
    const words = str.split(/[\s_-]+/);
    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };
  // When there is a message, show the compact card with collapsible content
  return (
    <div className={cn("tool-card noselect compact", { animated: animated })}>
      <div
        className="flex items-center gap-1 cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={toggleCollapse}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            toggleCollapse();
          }
        }}
      >
        <button
          className="text-gray-400 hover:text-gray-600 transition-colors duration-200 rounded flex"
          aria-label={isCollapsed ? "Expand" : "Collapse"}
        >
          <svg
            className={cn("w-3 h-3 transition-transform duration-200 -rotate-90", {
              "rotate-0": !isCollapsed,
            })}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <h3 className={cn("tool-card-title", isLoading && "shimmer")}>
          {pascalCase(functionName)}
        </h3>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: isCollapsed ? "0fr" : "1fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "canselect rounded-md border! px-2 py-1 mt-1 transition-opacity duration-200 relative",
              isCollapsed ? "opacity-0" : "opacity-100",
            )}
            style={{
              borderColor: "var(--pd-border-color) !important",
            }}
          >
            {/* Scrollable content with max height - hide scrollbar */}
            <div
              ref={scrollContainerRef}
              className="max-h-[100px] overflow-y-auto scrollbar-hide"
              style={{
                scrollbarWidth: "none", // Firefox
                msOverflowStyle: "none", // IE and Edge
              }}
            >
              <Streamdown
                className="text-[11px] text-gray-400"
                plugins={{ code, mermaid, math, cjk }}
                isAnimating={isLoading}
                linkSafety={{ enabled: false }}
              >
                {message}
              </Streamdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
