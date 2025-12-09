import { PaperScoreResultSchema } from "../../../pkg/gen/apiclient/project/v1/project_pb";
import { fromJson } from "@bufbuild/protobuf";
import { LoadingIndicator } from "../../loading-indicator";
import { logError } from "../../../libs/logger";
import { cn } from "@heroui/react";

type PaperScoreCardProps = {
  message: string;
  preparing: boolean;
  animated: boolean;
};

export const PaperScoreCard = ({ message, preparing, animated }: PaperScoreCardProps) => {
  try {
    if (preparing) {
      return (
        <div className={cn("tool-card", { animated: animated })}>
          <h3 className="tool-card-title">Paper Score</h3>
          <LoadingIndicator text="Calculating ..." estimatedSeconds={60} />
        </div>
      );
    }
    if (!message || message === "") {
      return (
        <div className="tool-card">
          <h3 className="tool-card-title">Paper Score</h3>
          <div className="!text-xs !text-primary-600">No paper score result.</div>
        </div>
      );
    }

    const json = message.match(/<RESULT>(.*?)<\/RESULT>/)?.[1];
    if (!json) {
      return (
        <div className="tool-card">
          <h3 className="tool-card-title">Paper Score</h3>
          <div className="!text-xs !text-primary-600">Failed to parse paper score. {message}</div>
        </div>
      );
    }
    const toolCall = fromJson(PaperScoreResultSchema, JSON.parse(json));
    const currentPercentile = Number(Number(toolCall.percentile).toFixed(2)) * 100;
    const currentScore = Number(toolCall.score).toFixed(0);
    return (
      <div className="tool-card noselect">
        {/* Current Score Section */}
        <div>
          <h3 className="tool-card-title">Current Paper Score</h3>
          <div className="flex !items-baseline !gap-2">
            <span className="!text-4xl !font-bold !text-primary-900">{currentScore}</span>
            <span className="!text-lg !text-primary-700">points</span>
          </div>
          <div className="flex !items-baseline !gap-2">
            <span className="!text-sm !text-primary-700">{currentPercentile}% percentile</span>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    logError("Failed to parse paper score", error, message);
    return (
      <div className="tool-card">
        <h3 className="tool-card-title">Paper Score</h3>
        <div className="!text-xs !text-primary-600">Error occurred while parsing paper score.</div>
      </div>
    );
  }
};
