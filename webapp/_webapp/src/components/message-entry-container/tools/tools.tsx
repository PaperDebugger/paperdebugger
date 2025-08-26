import { PaperScoreCard } from "./paper-score";
import { PaperScoreCommentCard } from "./paper-score-comment/index";
import { UnknownToolCard } from "./unknown";
import { GreetingCard } from "./greeting";
import { ErrorToolCard } from "./error";
import { AlwaysExceptionCard } from "./always-exception";

type ToolsProps = {
  messageId: string;
  functionName: string;
  message: string;
  error: string;
  preparing: boolean;
  animated: boolean;
};

export default function Tools({
  messageId,
  functionName,
  message,
  error,
  preparing,
  animated,
}: ToolsProps) {
  if (error && error !== "") {
    return (
      <ErrorToolCard
        functionName={functionName}
        errorMessage={error}
        animated={animated}
      />
    );
  }

  if (functionName === "paper_score") {
    return (
      <PaperScoreCard
        message={message}
        preparing={preparing}
        animated={animated}
      />
    );
  } else if (functionName === "paper_score_comment") {
    return (
      <PaperScoreCommentCard
        messageId={messageId}
        message={message}
        preparing={preparing}
        animated={animated}
      />
    );
  } else if (functionName === "greeting") {
    return (
      <GreetingCard
        message={message}
        preparing={preparing}
        animated={animated}
      />
    );
  } else if (functionName === "always_exception") {
    return (
      <AlwaysExceptionCard
        message={message}
        preparing={preparing}
        animated={animated}
      />
    );
  }

  return (
    <UnknownToolCard
      functionName={functionName}
      message={message}
      animated={animated}
    />
  );
}
