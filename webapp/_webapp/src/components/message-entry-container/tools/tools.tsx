import { PaperScoreCard } from "./paper-score";
import { PaperScoreCommentCard } from "./paper-score-comment/index";
import { GreetingCard } from "./greeting";
import { ErrorToolCard } from "./error";
import { AlwaysExceptionCard } from "./always-exception";
import { XtraMcpGenericCard } from "./xtramcp-generic-card";
import { ReviewPaperCard } from "./review-paper";
import { SearchRelevantPapersCard } from "./search-relevant-papers";
import { VerifyCitationsCard } from "./verify-citations";
import { isXtraMcpTool } from "./utils/common";
import { GeneralToolCard } from "./general";

type ToolsProps = {
  messageId: string;
  functionName: string;
  message: string;
  error: string;
  preparing: boolean;
  animated: boolean;
};

export default function Tools({ messageId, functionName, message, error, preparing, animated }: ToolsProps) {
  if (error && error !== "") {
    return <ErrorToolCard functionName={functionName} errorMessage={error} animated={animated} />;
  }

  // Check if tool is one of the XtraMCP tools
  const isXtraMcp = isXtraMcpTool(functionName);

  // Legacy tool handlers (non-XtraMCP format)
  if (functionName === "paper_score") {
    return <PaperScoreCard message={message} preparing={preparing} animated={animated} />;
  } else if (functionName === "paper_score_comment") {
    return <PaperScoreCommentCard messageId={messageId} message={message} preparing={preparing} animated={animated} />;
  } else if (functionName === "greeting") {
    return <GreetingCard message={message} preparing={preparing} animated={animated} />;
  } else if (functionName === "always_exception") {
    return <AlwaysExceptionCard message={message} preparing={preparing} animated={animated} />;
  }

  // XtraMCP specialized tool handlers
  if (isXtraMcp) {
    if (functionName === "review_paper") {
      return (
        <ReviewPaperCard
          functionName={functionName}
          message={message}
          preparing={preparing}
          animated={animated}
        />
      );
    } else if (functionName === "search_relevant_papers") {
      return (
        <SearchRelevantPapersCard
          functionName={functionName}
          message={message}
          preparing={preparing}
          animated={animated}
        />
      );
    } else if (functionName === "verify_citations") {
      return (
        <VerifyCitationsCard
          functionName={functionName}
          message={message}
          preparing={preparing}
          animated={animated}
        />
      );
    }

    // Generic XtraMCP tool (not specialized)
    return <XtraMcpGenericCard functionName={functionName} message={message} preparing={preparing} animated={animated} />;
  }

  // Fallback to general tool card (non-XtraMCP tools)
  return <GeneralToolCard functionName={functionName} message={message} animated={animated} />;
}
