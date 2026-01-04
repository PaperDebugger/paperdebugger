export type XtraMcpToolResult = {
  schema_version: string;
  display_mode: "verbatim" | "interpret";
  content?: string | object;
  metadata?: Record<string, any>;
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
  // ENHANCER TOOLS
  // "enhance_academic_writing",
  // OPENREVIEW ONLINE TOOLS
  // "search_user",
  // "get_user_papers"
];

export const isXtraMcpTool = (functionName: string): boolean => {
  return XTRA_MCP_TOOL_NAMES.includes(functionName);
};

export const isXtraMcpToolResult = (message?: string): boolean => {
  if (!message) return false;

  try {
    const parsed = JSON.parse(message);
    return parsed.schema_version?.startsWith('xtramcp.tool_result') ?? false;
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
