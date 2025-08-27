import { cn } from "@heroui/react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { OverleafComment } from "../../../../pkg/gen/apiclient/project/v1/project_pb";

type FilterControlsProps = {
  comments: OverleafComment[];
  filterImportance: string;
  setFilterImportance: (value: string) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  isSuggestionsExpanded: boolean;
  setIsSuggestionsExpanded: (value: boolean) => void;
  showFilters: boolean;
};

export const FilterControls = ({
  comments,
  filterImportance,
  setFilterImportance,
  searchTerm,
  setSearchTerm,
  isSuggestionsExpanded,
  setIsSuggestionsExpanded,
  showFilters,
}: FilterControlsProps) => {
  const filteredCount = comments.filter((comment) => {
    const matchesImportance = !filterImportance || comment.importance === filterImportance;
    const matchesSearch =
      !searchTerm ||
      comment.comment.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (comment.quoteText && comment.quoteText.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesImportance && matchesSearch;
  }).length;

  const hasActiveFilters = searchTerm || filterImportance;

  return (
    <div>
      <div
        className="!flex !items-center !justify-between !mb-1 !px-2 cursor-pointer"
        onClick={() => setIsSuggestionsExpanded(!isSuggestionsExpanded)}
      >
        <button className="!flex !items-center !gap-2 !text-sm !font-semibold !text-gray-800 hover:!text-gray-600 !transition-colors truncate">
          <Icon
            icon={isSuggestionsExpanded ? "tabler:chevron-down" : "tabler:chevron-right"}
            className="!w-4 !h-4 !transition-transform"
          />
          Detailed Suggestions
        </button>
        <div className="!flex !items-center !gap-2" id="filter-controls-count">
          <div className="!text-xs !text-gray-500 overflow-hidden truncate">
            {filteredCount === comments.length
              ? `Total ${comments.length} suggestions`
              : `Showing ${filteredCount}/${comments.length} suggestions`}
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchTerm("");
                setFilterImportance("");
              }}
              className="!text-xs !text-primary-600 !underline hover:!text-primary-800"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {isSuggestionsExpanded && showFilters && (
        <div className="!mb-2 !flex !flex-wrap !gap-2 !items-center px-2">
          <div className="!flex !items-center !gap-2">
            <span className="!text-xs !text-gray-600">Importance:</span>
            {["Critical", "High", "Medium"].map((importance) => (
              <button
                key={importance}
                onClick={() => setFilterImportance(filterImportance === importance ? "" : importance)}
                className={cn(
                  "!px-2 !py-1 !text-xs !rounded !border !transition-colors",
                  filterImportance === importance
                    ? "!bg-primary-100 !text-primary-800 !border-primary-300"
                    : "!bg-gray-100 !text-gray-600 !border-gray-300 hover:!bg-gray-200",
                )}
              >
                {importance}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search suggestions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="!px-2 !py-1 !text-xs !border !rounded !flex-1 !min-w-0"
          />
        </div>
      )}
    </div>
  );
};
