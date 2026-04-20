import { cn, Spinner } from "@heroui/react";
import { useCallback, useState } from "react";
import { Prompt, PromptSchema } from "@gen/apiclient/user/v1/user_pb";
import { ChatButton } from "../chat/header/chat-button";
import { toJson } from "@bufbuild/protobuf";
import { fromJson } from "@/libs/protobuf-utils";
import { usePromptLibraryStore } from "@/stores/prompt-library-store";

type PromptLibraryTableProps = {
  onDelete: (prompt: Prompt) => void;
  onUpdate: (prompt: Prompt) => void;
  onView: (prompt: Prompt) => void;
};

export function PromptLibraryTable({ onDelete, onUpdate, onView }: PromptLibraryTableProps) {
  const { isLoading, prompts } = usePromptLibraryStore();
  const [filter, setFilter] = useState("");
  const searchPrompts = useCallback(
    (query: string) =>
      prompts.filter(
        (prompt) =>
          prompt.title.toLowerCase().includes(query.toLowerCase()) ||
          prompt.content.toLowerCase().includes(query.toLowerCase()),
      ),
    [prompts],
  );
  const filteredPrompts = searchPrompts(filter);

  const duplicatePrompt = useCallback((prompt: Prompt) => {
    const promptJson = toJson(PromptSchema, prompt);
    return fromJson(PromptSchema, promptJson);
  }, []);

  return isLoading ? (
    <div className="flex w-full h-full items-center justify-center">
      <Spinner variant="gradient" color="default" />
    </div>
  ) : (
    <div className="flex flex-col gap-2">
      <div className="w-full flex flex-row gap-2 items-center px-4 py-2 border border-gray-200! dark:!border-default-200 bg-gray-50 dark:!bg-default-100 rounded-md noselect">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search Prompts"
          className="w-full text-xs border-none focus:outline-none text-center bg-transparent noselect"
        />
      </div>
      <div className="w-full flex flex-col bg-gray-50 dark:!bg-default-100">
        {filteredPrompts.map((prompt) => (
          <div
            key={prompt.id}
            className={cn(
              "w-full flex flex-row gap-2 items-center px-4 py-2 noselect",
              "border-l border-r border-gray-200! dark:!border-default-200",
              "first:border-t last:border-b first:rounded-t-md last:rounded-b-md border-t border-gray-200! dark:!border-default-200",
            )}
          >
            <div className="grow flex flex-col gap-1 min-w-0">
              <div className="text-xs font-medium truncate">{prompt.title}</div>
              <div className="text-xs text-gray-500 truncate dark:text-default-500">{prompt.content}</div>
            </div>
            <div className="flex flex-row gap-1">
              <ChatButton
                icon="tabler:eye"
                alt="View Prompt"
                tooltip="View Details"
                noBorder
                disableAnimation
                onClick={() =>
                  prompt.isUserPrompt ? onUpdate(duplicatePrompt(prompt)) : onView(duplicatePrompt(prompt))
                }
              />
              {prompt.isUserPrompt && (
                <ChatButton
                  icon="tabler:trash"
                  variant="danger"
                  alt="Delete Prompt"
                  tooltip="Delete"
                  noBorder
                  disableAnimation
                  onClick={() => onDelete(duplicatePrompt(prompt))}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
