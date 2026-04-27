import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { OverleafComment } from "../../../../pkg/gen/apiclient/project/v1/project_pb";
import { useSocketStore } from "../../../../stores/socket-store";
import {
  addClickedOverleafComment,
  addClickedOverleafTexComment,
  hasClickedOverleafComment,
  hasClickedOverleafTexComment,
} from "../../../../libs/helpers";
import { acceptComments } from "../../../../query/api";
import { fromJson } from "../../../../libs/protobuf-utils";
import { CommentsAcceptedRequestSchema } from "../../../../pkg/gen/apiclient/comment/v1/comment_pb";
import { useConversationStore } from "../../../../stores/conversation/conversation-store";
import { errorToast, successToast } from "../../../../libs/toasts";
import { formatTexSourceComment } from "./utils";

type AddCommentsButtonProps = {
  projectId: string;
  messageId: string;
  comments: OverleafComment[];
  overleafSession: string;
  gclb: string;
  setIsSuggestionsExpanded: (value: boolean) => void;
  shouldAutoInsertTexComments?: boolean;
};

export const AddCommentsButton = ({
  projectId,
  messageId,
  comments,
  overleafSession,
  gclb,
  setIsSuggestionsExpanded,
  shouldAutoInsertTexComments = false,
}: AddCommentsButtonProps) => {
  const { connectSocket, disconnectSocket, addComment, addTexComments } = useSocketStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isTexLoading, setIsTexLoading] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [texProgress, setTexProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [texErrorMessage, setTexErrorMessage] = useState("");
  const { currentConversation } = useConversationStore();
  const hasAttemptedAutoInsert = useRef(false);
  const uniqueDocPaths = Array.from(new Set(comments.map((comment) => comment.docPath).filter(Boolean)));
  const uniqueSections = Array.from(new Set(comments.map((comment) => comment.section).filter(Boolean)));
  const targetSummary =
    uniqueDocPaths.length === 0
      ? "current selection"
      : uniqueDocPaths.length <= 2
        ? uniqueDocPaths.join(", ")
        : `${uniqueDocPaths.slice(0, 2).join(", ")} +${uniqueDocPaths.length - 2} more`;

  const handleAddComments = async () => {
    setIsLoading(true);
    setCurrentProgress(0);
    setErrorMessage("");
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
      successToast(`Added ${comments.length} Overleaf thread(s) for ${targetSummary}.`, "Review Threads Added");
      acceptComments(
        fromJson(CommentsAcceptedRequestSchema, {
          projectId: projectId,
          conversationId: currentConversation.id,
          messageId: messageId,
          commentIds: comments.map((comment) => comment.commentId || "").filter((id) => id.length > 0),
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setErrorMessage(message);
      errorToast(message, "Overleaf Thread Add Failed");
    } finally {
      setIsLoading(false);
      setCurrentProgress(0);
    }
  };

  const handleAddTexComments = async () => {
    setIsTexLoading(true);
    setTexProgress(0);
    setTexErrorMessage("");

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

      await addTexComments(
        comments.map((comment) => ({
          ...comment,
          comment: formatTexSourceComment(comment.importance, comment.section, comment.comment),
        })),
      );
      setTexProgress(comments.length);

      disconnectSocket();
      addClickedOverleafTexComment(projectId, messageId);
      setIsSuggestionsExpanded(false);
      successToast(`Inserted ${comments.length} TeX comment block(s) into ${targetSummary}.`, "TeX Comments Inserted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setTexErrorMessage(message);
      errorToast(message, "TeX Comment Insert Failed");
    } finally {
      setIsTexLoading(false);
      setTexProgress(0);
    }
  };

  const alreadyClicked = hasClickedOverleafComment(projectId, messageId);
  const alreadyInsertedTex = hasClickedOverleafTexComment(projectId, messageId);
  const hasValidCookies = overleafSession.length > 0;

  useEffect(() => {
    if (!shouldAutoInsertTexComments) return;
    if (hasAttemptedAutoInsert.current) return;
    if (!hasValidCookies || comments.length === 0 || alreadyInsertedTex || isTexLoading) return;

    hasAttemptedAutoInsert.current = true;
    void handleAddTexComments();
  }, [shouldAutoInsertTexComments, hasValidCookies, comments.length, alreadyInsertedTex, isTexLoading]);

  return (
    <>
      <div className="!mt-2 !grid !grid-cols-1 md:!grid-cols-2 !gap-2">
        <button
          onClick={handleAddComments}
          disabled={isLoading || isTexLoading || comments.length === 0 || alreadyClicked || !hasValidCookies || errorMessage.length > 0}
          className="w-full !bg-primary-600 hover:!bg-primary-700 !text-white !font-medium !py-2 !px-4 !rounded-lg !transition-colors !duration-200 !flex !items-center !justify-center !gap-2 disabled:!opacity-50 disabled:!cursor-not-allowed noselect"
        >
          {isLoading ? (
            <div className="flex flex-row items-center justify-center">
              <Icon icon="tabler:loader" className="!animate-spin !-ml-1 !mr-3 !h-5 !w-5 !text-white" />
              <div className="text-nowrap text-ellipsis overflow-hidden">
                Adding Threads ({currentProgress}/{comments.length})
              </div>
            </div>
          ) : alreadyClicked ? (
            <span className="text-nowrap text-ellipsis overflow-hidden flex flex-row items-center justify-center">
              <Icon icon="tabler:check" className="!w-4 !h-4 !mr-2" />
              Added Threads
            </span>
          ) : !hasValidCookies ? (
            <span className="text-nowrap text-ellipsis overflow-hidden">
              Overleaf session required
            </span>
          ) : errorMessage.length > 0 ? (
            <span className="text-nowrap text-ellipsis overflow-hidden">Thread Add Failed</span>
          ) : (
            <span className="text-nowrap text-ellipsis overflow-hidden">Add {comments.length} Overleaf Threads</span>
          )}
        </button>

        <button
          onClick={handleAddTexComments}
          disabled={isLoading || isTexLoading || comments.length === 0 || alreadyInsertedTex || !hasValidCookies}
          className="w-full !bg-emerald-600 hover:!bg-emerald-700 !text-white !font-medium !py-2 !px-4 !rounded-lg !transition-colors !duration-200 !flex !items-center !justify-center !gap-2 disabled:!opacity-50 disabled:!cursor-not-allowed noselect"
        >
          {isTexLoading ? (
            <div className="flex flex-row items-center justify-center">
              <Icon icon="tabler:loader" className="!animate-spin !-ml-1 !mr-3 !h-5 !w-5 !text-white" />
              <div className="text-nowrap text-ellipsis overflow-hidden">
                Inserting TeX Comments ({texProgress}/{comments.length})
              </div>
            </div>
          ) : alreadyInsertedTex ? (
            <span className="text-nowrap text-ellipsis overflow-hidden flex flex-row items-center justify-center">
              <Icon icon="tabler:check" className="!w-4 !h-4 !mr-2" />
              Inserted in TeX
            </span>
          ) : !hasValidCookies ? (
            <span className="text-nowrap text-ellipsis overflow-hidden">
              Overleaf session required
            </span>
          ) : (
            <span className="text-nowrap text-ellipsis overflow-hidden">Insert {comments.length} TeX Comments</span>
          )}
        </button>
      </div>
      {errorMessage.length > 0 && (
        <div className="!mt-2 !text-xs font-bold !text-red-500 noselect text-nowrap text-ellipsis overflow-hidden animate-pulse">
          Error: {errorMessage}
        </div>
      )}
      {texErrorMessage.length > 0 && (
        <div className="!mt-2 !text-xs font-bold !text-red-500 noselect text-nowrap text-ellipsis overflow-hidden animate-pulse">
          TeX insert error: {texErrorMessage}
        </div>
      )}
      <div className="!mt-2 !text-xs !text-primary-600 noselect overflow-hidden">
        Thread mode adds native Overleaf review threads. TeX mode inserts real `% PaperDebugger ...` comments into the `.tex` source.
      </div>
      <div className="!mt-2 !flex !flex-wrap !gap-2 !text-xs noselect">
        <span className="!px-2 !py-1 !rounded-full !bg-default-100 !text-default-700">
          Files: {targetSummary}
        </span>
        {uniqueSections.length > 0 && (
          <span className="!px-2 !py-1 !rounded-full !bg-primary-50 !text-primary-700">
            Sections: {uniqueSections.length}
          </span>
        )}
        <span className="!px-2 !py-1 !rounded-full !bg-emerald-50 !text-emerald-700">
          Mentions: {comments.length} target point(s)
        </span>
      </div>
      {/* TODO: report user selected comments to server */}
    </>
  );
};
