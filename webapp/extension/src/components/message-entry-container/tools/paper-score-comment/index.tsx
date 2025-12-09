import { fromJson, JsonValue } from "@bufbuild/protobuf";
import { OverleafCommentSchema } from "../../../../pkg/gen/apiclient/project/v1/project_pb";
import { getProjectId } from "../../../../libs/helpers";
import { useEffect, useState } from "react";
import { LoadingIndicator } from "../../../loading-indicator";
import { cn } from "@heroui/react";
import { ErrorToolCard } from "../error";
import { Icon } from "@iconify/react/dist/iconify.js";
import { getCookies } from "../../../../intermediate";
import { PaperScoreCommentCardProps } from "./types";
import { StatsSummary } from "./stats-summary";
import { FilterControls } from "./filter-controls";
import { CommentsList } from "./comments-list";
import { AddCommentsButton } from "./add-comments-button";

const CardBody = ({ children }: { children: React.ReactNode }) => {
  return <div className="tool-card noselect">{children}</div>;
};

export const PaperScoreCommentCard = ({ messageId, message, preparing, animated }: PaperScoreCommentCardProps) => {
  const projectId = getProjectId();
  const [overleafSession, setOverleafSession] = useState("");
  const [gclb, setGclb] = useState("");
  const [isSuggestionsExpanded, setIsSuggestionsExpanded] = useState(false);
  const [filterImportance, setFilterImportance] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedComments, setSelectedComments] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    getCookies(window.location.hostname).then((cookies) => {
      setOverleafSession(cookies.session);
      setGclb(cookies.gclb);
    });
  }, []);

  // Initialize selectedComments with all comment IDs when comments are available
  useEffect(() => {
    if (message && message !== "") {
      try {
        const response: unknown[] = JSON.parse(message);
        const comments = response.map((comment: unknown) => {
          return fromJson(OverleafCommentSchema, comment as JsonValue);
        });

        if (comments.length > 0) {
          const allCommentIds = comments.map(
            (comment) => comment.commentId || `${comment.docPath}:${comment.quotePosition}`,
          );
          setSelectedComments(new Set(allCommentIds));
        }
      } catch (error) {
        // eslint-disable-line @typescript-eslint/no-unused-vars
        // Ignore parsing errors here, they'll be handled in the render
      }
    }
  }, [message]);

  if (preparing) {
    return (
      <div className={cn("tool-card", { animated: animated })}>
        <LoadingIndicator text="Analyzing weaknesses ..." estimatedSeconds={120} />
      </div>
    );
  }

  if (!message || message === "") {
    return (
      <div className="tool-card">
        <h3 className="tool-card-title">Paper Score Comment</h3>
        <div className="text-xs text-primary-600">No paper score comment result.</div>
      </div>
    );
  }

  try {
    const response: unknown[] = JSON.parse(message);
    const comments = response.map((comment: unknown) => {
      return fromJson(OverleafCommentSchema, comment as JsonValue);
    });

    if (comments.length === 0) {
      return (
        <CardBody>
          <div className="!text-gray-500">
            <Icon icon="tabler:file-like" className="!w-12 !h-12 !mx-auto !mb-2" />
            <p className="!text-sm !text-gray-600 !text-center">No comments left for this paper.</p>
          </div>
        </CardBody>
      );
    }

    const handleCommentToggle = (commentId: string) => {
      setSelectedComments((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(commentId)) {
          newSet.delete(commentId);
        } else {
          newSet.add(commentId);
        }
        return newSet;
      });
    };

    const handleSelectAll = () => {
      const allCommentIds = comments.map(
        (comment) => comment.commentId || `${comment.docPath}:${comment.quotePosition}`,
      );
      setSelectedComments(new Set(allCommentIds));
    };

    const handleDeselectAll = () => {
      setSelectedComments(new Set());
    };

    const selectedCommentsList = comments.filter((comment) =>
      selectedComments.has(comment.commentId || `${comment.docPath}:${comment.quotePosition}`),
    );

    return (
      <CardBody>
        <StatsSummary comments={comments} />

        <div
          className={cn(
            "border rounded-lg pt-1 transition-all duration-300 noselect",
            isSuggestionsExpanded ? "h-[27.45rem] overflow-y-auto" : "h-[2rem] overflow-hidden",
          )}
        >
          <FilterControls
            comments={comments}
            filterImportance={filterImportance}
            setFilterImportance={setFilterImportance}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            isSuggestionsExpanded={isSuggestionsExpanded}
            setIsSuggestionsExpanded={setIsSuggestionsExpanded}
            showFilters={showFilters}
          />

          <CommentsList
            comments={comments}
            filterImportance={filterImportance}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            setFilterImportance={setFilterImportance}
            selectedComments={selectedComments}
            onCommentToggle={handleCommentToggle}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
          />
        </div>

        <AddCommentsButton
          projectId={projectId}
          messageId={messageId}
          comments={selectedCommentsList}
          overleafSession={overleafSession}
          gclb={gclb}
          setIsSuggestionsExpanded={setIsSuggestionsExpanded}
        />
      </CardBody>
    );
  } catch (error) {
    return (
      <ErrorToolCard
        functionName="paper_score_comment"
        errorMessage={`Failed to parse paper score comment: ${error}, message: ${message}`}
        animated={animated}
      />
    );
  }
};
