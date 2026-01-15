import { cn } from "@heroui/react";
import { useState } from "react";

type GeneralToolCardProps = {
  functionName: string;
  message: string;
  animated: boolean;
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

export const GeneralToolCard = ({ functionName, message, animated }: GeneralToolCardProps) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

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
    setIsCollapsed(!isCollapsed);
  };
  const pascalCase = (str: string) => {
    const words = str.split("_");
    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };
  // When there is a message, show the compact card with collapsible content
  return (
    <div className={cn("tool-card noselect compact", { animated: animated })}>
      <div className="flex items-center gap-1 cursor-pointer" onClick={toggleCollapse}>
        <button
          className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-0.5 rounded"
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
      </div>

      <div
        className={cn("canselect overflow-hidden transition-all duration-300 ease-in-out", {
          "max-h-0 opacity-0": isCollapsed,
          "max-h-[1000px] opacity-100": !isCollapsed,
        })}
      >
        <span className="text-[11px] text-gray-400">{message}</span>
      </div>
    </div>
  );
};
