import { Icon } from "@iconify/react";
import { Conversation } from "../pkg/gen/apiclient/chat/v2/chat_pb";
import { getConversation } from "../query/api";
import { useConversationStore } from "../stores/conversation/conversation-store";
import { useStreamingStateMachine } from "../stores/streaming";
import { useState } from "react";

interface BranchSwitcherProps {
  conversation?: Conversation;
}

export const BranchSwitcher = ({ conversation }: BranchSwitcherProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const setCurrentConversation = useConversationStore((s) => s.setCurrentConversation);
  const isStreaming = useConversationStore((s) => s.isStreaming);

  // Don't show if no branches or only one branch
  const totalBranches = conversation?.totalBranches ?? 0;
  if (totalBranches <= 1) {
    return null;
  }

  const currentIndex = conversation?.currentBranchIndex ?? 1;
  const branches = conversation?.branches ?? [];

  const switchToBranch = async (branchId: string) => {
    if (!conversation?.id || isLoading || isStreaming) return;

    setIsLoading(true);
    try {
      const response = await getConversation({
        conversationId: conversation.id,
        branchId: branchId,
      });
      if (response.conversation) {
        setCurrentConversation(response.conversation);
        useStreamingStateMachine.getState().reset();
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to switch branch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex <= 1) return;
    const prevBranchId = branches[currentIndex - 2]?.id;
    if (prevBranchId) {
      switchToBranch(prevBranchId);
    }
  };

  const handleNext = () => {
    if (currentIndex >= totalBranches) return;
    const nextBranchId = branches[currentIndex]?.id;
    if (nextBranchId) {
      switchToBranch(nextBranchId);
    }
  };

  const canGoPrev = currentIndex > 1 && !isLoading && !isStreaming;
  const canGoNext = currentIndex < totalBranches && !isLoading && !isStreaming;

  return (
    <div className="flex items-center gap-1 text-xs text-gray-400">
      <Icon icon="tabler:git-branch" className="w-3 h-3" />
      <button
        onClick={handlePrevious}
        disabled={!canGoPrev}
        className={`p-0.5 rounded hover:bg-gray-700/50 transition-colors ${
          canGoPrev ? "text-gray-600 cursor-pointer" : "text-gray-300 cursor-not-allowed"
        }`}
        title="Previous branch"
      >
        <Icon icon="tabler:chevron-left" className="w-3.5 h-3.5" />
      </button>
      <span className={`min-w-[3rem] text-center ${isLoading ? "text-gray-500" : ""}`}>
        {isLoading ? "..." : `${currentIndex} / ${totalBranches}`}
      </span>
      <button
        onClick={handleNext}
        disabled={!canGoNext}
        className={`p-0.5 rounded hover:bg-gray-700/50 transition-colors ${
          canGoNext ? "text-gray-600 cursor-pointer" : "text-gray-300 cursor-not-allowed"
        }`}
        title="Next branch"
      >
        <Icon icon="tabler:chevron-right" className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
