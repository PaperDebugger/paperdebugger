import { cn, Spinner } from "@heroui/react";
import { useEffect, useState } from "react";
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

const shimmerStyle = {
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
} as const;

export const GeneralToolCard = ({ functionName, message, animated, isCollapsed: externalIsCollapsed, onToggleCollapse, isLoading }: GeneralToolCardProps) => {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(true);

  // Use external state if provided, otherwise use internal state
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;

  // Sync internal state with external state when it changes
  useEffect(() => {
    if (externalIsCollapsed !== undefined) {
      setInternalIsCollapsed(externalIsCollapsed);
    }
  }, [externalIsCollapsed]);

  // When no message, show minimal "Calling tool..." style like Preparing function
  if (!message) {
    return (
      <div className="chat-message-entry">
        <span className="text-sm text-gray-400 loading-shimmer" style={shimmerStyle}>
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
      <div className="flex items-center gap-1 cursor-pointer" onClick={toggleCollapse}>
        <button
          className="text-gray-400 hover:text-gray-600 transition-colors duration-200 rounded"
          aria-label={isCollapsed ? "Expand" : "Collapse"}
        >
          <svg
            className={cn("w-3 h-3 transition-transform duration-200 rotate-[-90deg]", {
              "rotate-0": !isCollapsed,
            })}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <h3 className="tool-card-title">{pascalCase(functionName)}</h3>
        {isLoading && (
          <Spinner size="sm" color="default" variant="dots" classNames={{ base: "scale-75" }} />
        )}
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isCollapsed ? "0fr" : "1fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "canselect rounded-md !border px-2 py-1 mt-1 transition-opacity duration-200",
              {
                "opacity-0": isCollapsed,
                "opacity-100 !border-gray-200": !isCollapsed,
              }
            )}
          >
            <span className="text-[11px] text-gray-400">
              <Streamdown plugins={{ code, mermaid, math, cjk }} isAnimating={true}>
                {message}
              </Streamdown>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
