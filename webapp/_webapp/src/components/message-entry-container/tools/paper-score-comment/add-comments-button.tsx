import { useState } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { OverleafComment } from "../../../../pkg/gen/apiclient/project/v1/project_pb";
import { useSocketStore } from "../../../../stores/socket-store";
import { addClickedOverleafComment, hasClickedOverleafComment } from "../../../../libs/helpers";
import { acceptComments } from "../../../../query/api";
import { fromJson } from "@bufbuild/protobuf";
import { CommentsAcceptedRequestSchema } from "../../../../pkg/gen/apiclient/comment/v1/comment_pb";
import { useConversationStore } from "../../../../stores/conversation/conversation-store";

type AddCommentsButtonProps = {
  projectId: string;
  messageId: string;
  comments: OverleafComment[];
  overleafSession: string;
  gclb: string;
  setIsSuggestionsExpanded: (value: boolean) => void;
};

export const AddCommentsButton = ({
  projectId,
  messageId,
  comments,
  overleafSession,
  gclb,
  setIsSuggestionsExpanded,
}: AddCommentsButtonProps) => {
  const { connectSocket, disconnectSocket, addComment } = useSocketStore();
  const [isLoading, setIsLoading] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const { currentConversation } = useConversationStore();

  const handleAddComments = async () => {
    setIsLoading(true);
    setCurrentProgress(0);
    try {
      const csrfToken = document.querySelector('meta[name="ol-csrfToken"]')?.getAttribute("content") || "";
      if (csrfToken.length === 0) {
        throw new Error("CSRF token not found");
      }

      await connectSocket(
        projectId,
        {
          cookieOverleafSession2: overleafSession,
          cookieGCLB: gclb,
        },
        csrfToken,
      );

      for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        await addComment(
          projectId,
          comment.docId,
          comment.docVersion,
          comment.docSha1,
          comment.quotePosition,
          comment.quoteText,
          comment.comment,
          csrfToken,
        );
        setCurrentProgress(i + 1);
      }
      disconnectSocket();
      setErrorMessage("");
      addClickedOverleafComment(projectId, messageId);
      setIsSuggestionsExpanded(false);
      acceptComments(
        fromJson(CommentsAcceptedRequestSchema, {
          projectId: projectId,
          conversationId: currentConversation.id,
          messageId: messageId,
          commentIds: comments.map((comment) => comment.commentId || "").filter((id) => id.length > 0),
        }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
      setCurrentProgress(0);
    }
  };

  const alreadyClicked = hasClickedOverleafComment(projectId, messageId);
  const hasValidCookies = overleafSession.length > 0 && gclb.length > 0;

  return (
    <>
      <button
        onClick={handleAddComments}
        disabled={isLoading || comments.length === 0 || alreadyClicked || !hasValidCookies || errorMessage.length > 0}
        className="w-full !bg-primary-600 hover:!bg-primary-700 !text-white !font-medium !py-2 !px-4 !rounded-lg !transition-colors !duration-200 !flex !items-center !justify-center !gap-2 disabled:!opacity-50 disabled:!cursor-not-allowed noselect mt-2"
      >
        {isLoading ? (
          <div className="flex flex-row items-center justify-center">
            <Icon icon="tabler:loader" className="!animate-spin !-ml-1 !mr-3 !h-5 !w-5 !text-white" />
            <div className="text-nowrap text-ellipsis overflow-hidden">
              Adding Comments ({currentProgress}/{comments.length})
            </div>
          </div>
        ) : alreadyClicked ? (
          <span className="text-nowrap text-ellipsis overflow-hidden flex flex-row items-center justify-center">
            <Icon icon="tabler:check" className="!w-4 !h-4 !mr-2" />
            Added to Overleaf
          </span>
        ) : !hasValidCookies ? (
          <span className="text-nowrap text-ellipsis overflow-hidden">
            Can't add comments because cookies are not set
          </span>
        ) : errorMessage.length > 0 ? (
          <span className="text-nowrap text-ellipsis overflow-hidden">Failed</span>
        ) : (
          <span className="text-nowrap text-ellipsis overflow-hidden">Add {comments.length} Comments to Overleaf</span>
        )}
      </button>
      {errorMessage.length > 0 && (
        <div className="!mt-2 !text-xs font-bold !text-red-500 noselect text-nowrap text-ellipsis overflow-hidden animate-pulse">
          Error: {errorMessage}
        </div>
      )}
      <div className="!mt-2 !text-xs !text-primary-600 noselect text-nowrap text-ellipsis overflow-hidden">
        Note: this operation does not modify your paper.
      </div>
      {/* TODO: report user selected comments to server */}
    </>
  );
};
