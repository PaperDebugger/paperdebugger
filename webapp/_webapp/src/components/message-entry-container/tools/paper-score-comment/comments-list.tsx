import { Icon } from "@iconify/react/dist/iconify.js";
import { OverleafComment } from "../../../../pkg/gen/apiclient/project/v1/project_pb";
import { CommentItem } from "./comment-item";

type CommentsListProps = {
  comments: OverleafComment[];
  filterImportance: string;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  setFilterImportance: (value: string) => void;
  selectedComments: Set<string>;
  onCommentToggle: (commentId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  showFilters: boolean;
  setShowFilters: (value: boolean) => void;
};

export const CommentsList = ({
  comments,
  filterImportance,
  searchTerm,
  setSearchTerm,
  setFilterImportance,
  selectedComments,
  onCommentToggle,
  onSelectAll,
  onDeselectAll,
  showFilters,
  setShowFilters,
}: CommentsListProps) => {
  const filteredComments = comments
    .filter((comment) => {
      const matchesImportance = !filterImportance || comment.importance === filterImportance;
      const matchesSearch =
        !searchTerm ||
        comment.comment.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (comment.quoteText && comment.quoteText.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesImportance && matchesSearch;
    })
    .sort((a, b) => {
      const importanceOrder = { Critical: 3, High: 2, Medium: 1 };
      return (
        (importanceOrder[b.importance as keyof typeof importanceOrder] || 0) -
        (importanceOrder[a.importance as keyof typeof importanceOrder] || 0)
      );
    });

  const selectedCount = filteredComments.filter((comment) =>
    selectedComments.has(comment.commentId || `${comment.docPath}:${comment.quotePosition}`),
  ).length;

  if (filteredComments.length === 0) {
    return (
      <div className="!text-center !py-8 !text-gray-500">
        <Icon icon="tabler:search" className="!w-8 !h-8 !mx-auto !mb-2 !text-gray-400" />
        <p className="!text-sm">
          {searchTerm || filterImportance ? "No matching suggestions found" : "No suggestions"}
        </p>
        {(searchTerm || filterImportance) && (
          <button
            onClick={() => {
              setSearchTerm("");
              setFilterImportance("");
            }}
            className="!mt-2 !text-xs !text-primary-600 !underline hover:!text-primary-800"
          >
            Clear Filter
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="!space-y-2">
      {/* Selection controls */}
      <div className="!flex !items-center !justify-between !text-xs !text-gray-600 !mb-2 text-nowrap overflow-hidden text-ellipsis whitespace-nowrap px-2">
        <span>
          {selectedCount} of {filteredComments.length} selected
        </span>
        <div className="!flex !gap-2">
          <button onClick={onSelectAll} className="!text-primary-600 !underline hover:!text-primary-800">
            Select All
          </button>
          <button onClick={onDeselectAll} className="!text-primary-600 !underline hover:!text-primary-800">
            Deselect All
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="!text-primary-600 !underline hover:!text-primary-800"
          >
            Toggle Filter
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="!max-h-96 !overflow-y-auto">
        {filteredComments.map((comment) => {
          const commentId = comment.commentId || `${comment.docPath}:${comment.quotePosition}`;
          const isSelected = selectedComments.has(commentId);

          return (
            <CommentItem
              key={commentId}
              comment={comment}
              isSelected={isSelected}
              onToggle={() => onCommentToggle(commentId)}
            />
          );
        })}
      </div>
    </div>
  );
};
