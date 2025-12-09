import { PaperScoreCard } from "./paper-score";
import { PaperScoreCommentCard } from "./paper-score-comment/index";
import { UnknownToolCard } from "./unknown";
import { GreetingCard } from "./greeting";
import { ErrorToolCard } from "./error";
import { AlwaysExceptionCard } from "./always-exception";
import { JsonRpc } from "./jsonrpc";
import { parseJsonRpcResult, UNKNOWN_JSONRPC_RESULT } from "./utils/common";

type ToolsProps = {
  messageId: string;
  functionName: string;
  message: string;
  error: string;
  preparing: boolean;
  animated: boolean;
};

// define a const string list.
const XTRA_MCP_TOOL_NAMES = [
  // researcher tools
  "search_relevant_papers",
  "online_search_papers",
  "deep_research",
  // reviewer tools
  "review_paper",
  // enhancer tools
  "enhance_academic_writing",
  // misc
  "get_user_papers",
];

export default function Tools({ messageId, functionName, message, error, preparing, animated }: ToolsProps) {
  if (error && error !== "") {
    return <ErrorToolCard functionName={functionName} errorMessage={error} animated={animated} />;
  }

  const jsonRpcResult = parseJsonRpcResult(message);

  if (functionName === "paper_score") {
    return <PaperScoreCard message={message} preparing={preparing} animated={animated} />;
  } else if (functionName === "paper_score_comment") {
    return <PaperScoreCommentCard messageId={messageId} message={message} preparing={preparing} animated={animated} />;
  } else if (functionName === "greeting") {
    return <GreetingCard message={message} preparing={preparing} animated={animated} />;
  } else if (functionName === "always_exception") {
    return <AlwaysExceptionCard message={message} preparing={preparing} animated={animated} />;
  } else if (XTRA_MCP_TOOL_NAMES.includes(functionName)) {
    return (
      <JsonRpc
        functionName={functionName}
        jsonRpcResult={jsonRpcResult || UNKNOWN_JSONRPC_RESULT}
        preparing={preparing}
        animated={animated}
      />
    );
  }

  // fallback to unknown tool card if the json rpc result is not defined
  if (jsonRpcResult) {
    return (
      <JsonRpc functionName={functionName} jsonRpcResult={jsonRpcResult} preparing={preparing} animated={animated} />
    );
  } else {
    return <UnknownToolCard functionName={functionName} message={message} animated={animated} />;
  }
}
