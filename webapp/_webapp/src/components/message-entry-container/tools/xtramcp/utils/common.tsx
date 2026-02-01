import { cn } from "@heroui/react";
import { ReactNode } from "react";

export type XtraMcpToolResult = {
  schema_version: string;
  display_mode: "verbatim" | "interpret";
  content?: string | object;
  metadata?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  success?: boolean;
  error?: string;
};

export type XtraMcpToolCardProps = {
  functionName: string;
  message?: string;
  preparing: boolean;
  animated: boolean;
};

// we can probably handle this with a prefixed tool name check
// for now, whitelist the tools
const XTRA_MCP_TOOL_NAMES = [
  // RESEARCHER TOOLS
  "search_relevant_papers",
  "online_search_papers",
  "deep_research",
  // REVIEWER TOOLS
  "review_paper",
  "verify_citations",
  "generate_citations",
  // ENHANCER TOOLS
  // "enhance_academic_writing",
  // OPENREVIEW ONLINE TOOLS
  "search_user",
  "get_user_papers",
];

export const isXtraMcpTool = (functionName: string): boolean => {
  return XTRA_MCP_TOOL_NAMES.includes(functionName);
};

export const isXtraMcpToolResult = (message?: string): boolean => {
  if (!message) return false;

  try {
    const parsed = JSON.parse(message);
    return parsed.schema_version?.startsWith("xtramcp.tool_result") ?? false;
  } catch {
    return false;
  }
};

export const parseXtraMcpToolResult = (message?: string): XtraMcpToolResult | null => {
  if (!isXtraMcpToolResult(message)) return null;

  try {
    const parsed = JSON.parse(message!);
    return parsed as XtraMcpToolResult;
  } catch {
    return null;
  }
};

// Shared UI components
interface CollapseArrowButtonProps {
  isCollapsed: boolean;
  ariaLabel?: string;
}

export const CollapseArrowButton = ({ isCollapsed, ariaLabel }: CollapseArrowButtonProps) => (
  <button
    className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded"
    aria-label={ariaLabel || (isCollapsed ? "Expand" : "Collapse")}
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
);

interface CollapseWrapperProps {
  isCollapsed: boolean;
  children: ReactNode;
}

export const CollapseWrapper = ({ isCollapsed, children }: CollapseWrapperProps) => (
  <div
    className={cn("overflow-hidden transition-all duration-300 ease-in-out", {
      "max-h-0 opacity-0": isCollapsed,
      "max-h-[500px] opacity-100": !isCollapsed,
    })}
  >
    {children}
  </div>
);
