import { useState } from "react";
import { OverleafComment } from "../../../../pkg/gen/apiclient/project/v1/project_pb";
import { cn } from "@heroui/react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { getImportanceColor, getImportanceIcon, cleanCommentText } from "./utils";

type CommentItemProps = {
  comment: OverleafComment;
  isSelected: boolean;
  onToggle: () => void;
};

export const CommentItem = ({ comment, isSelected, onToggle }: CommentItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const truncatedQuoteText =
    comment.quoteText && comment.quoteText.length > 100
      ? `${comment.quoteText.substring(0, 100)}...`
      : comment.quoteText;

  return (
    <div
      className={cn("border-t border-b !p-3 !transition-colors", isSelected ? "!bg-primary-50/50" : "!bg-white")}
      id={comment.commentId}
    >
      <div className="!flex !items-center !justify-between !mb-2">
        <div className="!flex !items-center !gap-2">
          {/* Checkbox for selection */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={cn(
              "!w-4 !h-4 !border-2 !rounded !flex !items-center !justify-center !transition-colors",
              isSelected ? "!bg-primary-600 !border-primary-600" : "!border-gray-300 hover:!border-primary-400",
            )}
          >
            {isSelected && <Icon icon="tabler:check" className="!w-3 !h-3 !text-white" />}
          </button>

          <div
            className={cn(
              "!inline-flex !items-center !px-1 !py-0.5 !rounded-full !text-xs !font-medium !border",
              getImportanceColor(comment.importance),
            )}
          >
            <Icon icon={getImportanceIcon(comment.importance)} className="!w-3 !h-3 !mr-1" />
            {comment.importance}
          </div>
        </div>
        <div className="!text-xs !text-gray-500">{isSelected ? "Selected" : "Click to select"}</div>
      </div>

      {comment.quoteText && (
        <div className="!mb-2">
          <div className="!text-xs font-bold !text-gray-900 !mb-1">Section: {comment.section}</div>
          <div className="!bg-gray-100 !border-l-4 !border-primary-500 !pl-3 !py-2 !text-sm !text-gray-800 !italic">
            "{isExpanded ? comment.quoteText : truncatedQuoteText}"
            {comment.quoteText.length > 100 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="!ml-2 !text-primary-600 !text-xs !underline hover:!text-primary-800"
              >
                {isExpanded ? "Collapse" : "Expand"}
              </button>
            )}
          </div>
        </div>
      )}

      <div>
        <div className="!text-xs font-bold !text-gray-900 !mb-1">Suggestion:</div>
        <div className="!text-sm !text-gray-800 !leading-relaxed">{cleanCommentText(comment.comment)}</div>
      </div>
      <p className="!text-xs !text-gray-400">
        Position: {comment.docPath}:{comment.quotePosition}
      </p>
    </div>
  );
};
