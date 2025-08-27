import { Input, Listbox, ListboxItem, ListboxSection, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";
import { Conversation } from "../../../pkg/gen/apiclient/chat/v1/chat_pb";
import { getConversation, updateConversation } from "../../../query/api";
import { errorToast } from "../../../libs/toasts";
import { useDeleteConversationMutation, useListConversationsQuery } from "../../../query";
import { logError } from "../../../libs/logger";
import { Modal } from "../../../components/modal";
import googleAnalytics from "../../../libs/google-analytics";
import { useStreamingMessageStore } from "../../../stores/streaming-message-store";
import { getProjectId } from "../../../libs/helpers";
import { useConversationStore } from "../../../stores/conversation/conversation-store";
import { useConversationUiStore } from "../../../stores/conversation/conversation-ui-store";
import { useAuthStore } from "../../../stores/auth-store";

export const ChatHistoryModal = () => {
  const { currentConversation, setCurrentConversation } = useConversationStore();
  const { inputRef: promptInputRef } = useConversationUiStore();
  const { showChatHistory, setShowChatHistory } = useConversationUiStore();
  const {
    data: conversations,
    isFetching: isFetchingConversations,
    refetch: refetchConversationList,
  } = useListConversationsQuery(getProjectId());

  // State
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Refs
  const inputRef = useRef<HTMLInputElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  // Mutations
  const deleteConversationMutation = useDeleteConversationMutation({
    onSuccess: async () => {
      await refetchConversationList();
      setDeletingId(null);
    },
    onError: () => {
      errorToast("Failed to delete conversation");
      setDeletingId(null);
    },
  });

  // Title editing handlers
  const handleEditTitle = (chat: Conversation) => {
    setEditingTitleId(chat.id);
    setEditedTitle(chat.title);
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 0);
  };

  const handleSaveTitle = async (id: string) => {
    if (!editedTitle.trim()) {
      setEditingTitleId(null);
      return;
    }

    const chatToUpdate = conversations?.conversations.find((chat) => chat.id === id);
    if (!chatToUpdate || chatToUpdate.title === editedTitle.trim()) {
      setEditingTitleId(null);
      return;
    }

    try {
      googleAnalytics.fireEvent(user?.id, "conversation_update_title", {
        conversationId: id,
      });
      await updateConversation({
        conversationId: id,
        title: editedTitle.trim(),
      });
      await refetchConversationList();
      setEditingTitleId(null);
    } catch (e) {
      errorToast("Failed to update conversation title");
      logError(e);
    }
  };

  const handleCancelEdit = () => setEditingTitleId(null);

  // Delete handler
  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    googleAnalytics.fireEvent(user?.id, "conversation_delete", {
      conversationId: id,
    });
    e.stopPropagation();
    setDeletingId(id);
    deleteConversationMutation.mutate({ conversationId: id });
  };

  // Load conversation handler
  const handleHistoryClick = async (conversationId: string) => {
    try {
      googleAnalytics.fireEvent(user?.id, "conversation_load", {
        conversationId: conversationId,
      });

      const response = await getConversation({ conversationId });
      if (!response.conversation) {
        throw new Error(`Failed to load conversation ${conversationId}`);
      }
      setCurrentConversation(response.conversation);
      useStreamingMessageStore.getState().resetStreamingMessage();
      useStreamingMessageStore.getState().resetIncompleteIndicator();
      setShowChatHistory(false);
      promptInputRef.current?.focus();
    } catch (e) {
      errorToast(`Failed to load conversation ${conversationId}`);
      logError(e);
    }
  };

  // Filter conversations
  const filteredHistory =
    conversations?.conversations.filter((chat) => chat.title.toLowerCase().includes(searchQuery.toLowerCase())) || [];

  // Render functions
  const renderChatItem = (chat: Conversation) => (
    <ListboxItem
      aria-label="Chat History Item"
      key={chat.id}
      onMouseEnter={() => setHoveredItemId(chat.id)}
      onMouseLeave={() => setHoveredItemId(null)}
      onPress={() => handleHistoryClick(chat.id)}
      className="h-[44px] px-[12px] py-[10px] text-default-500 mt-1 w-full"
      classNames={{
        wrapper: "w-full",
        title: "w-full",
        base: "w-full",
      }}
    >
      <div className="flex justify-between items-center w-full">
        {editingTitleId === chat.id ? (
          <TitleEditInput
            ref={editInputRef}
            value={editedTitle}
            onChange={(e) => {
              e.stopPropagation();
              setEditedTitle(e.target.value);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                handleSaveTitle(chat.id);
                e.preventDefault();
              } else if (e.key === "Escape") {
                handleCancelEdit();
                e.preventDefault();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => handleSaveTitle(chat.id)}
          />
        ) : (
          <span className="truncate">{chat.title}</span>
        )}

        <ActionButtons
          chatId={chat.id}
          hoveredItemId={hoveredItemId}
          deletingId={deletingId}
          isPending={deleteConversationMutation.isPending}
          isCurrent={chat.id === currentConversation.id}
          onEdit={() => handleEditTitle(chat)}
          onDelete={handleDeleteConversation}
        />
      </div>
    </ListboxItem>
  );

  // refetch conversation list when showHistory is true
  useEffect(() => {
    if (showChatHistory) {
      refetchConversationList();
    }
  }, [showChatHistory, refetchConversationList]);

  return (
    <Modal
      isOpen={showChatHistory}
      onOpenChange={(open) => {
        if (open) inputRef.current?.focus();
        setShowChatHistory(open);
      }}
      disableAnimation={true}
      className="noselect modal-zindex-important"
      content={
        <div className="flex flex-col gap-2 pt-2 pb-0 pl-2 pr-2">
          <div className="flex items-center">
            <Input
              ref={inputRef}
              fullWidth
              aria-label="search"
              className="px-1 mt-1"
              labelPlacement="outside"
              placeholder={isFetchingConversations ? "Loading..." : "Search..."}
              onValueChange={setSearchQuery}
              startContent={<Icon className="text-default-500 [&>g]:stroke-[2px]" icon="tabler:search" width={18} />}
            />
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-gray-400 text-sm self-center pb-4 pt-3">No chat history found</div>
          ) : (
            <Listbox aria-label="Chat history" variant="flat" classNames={{ list: "max-h-[300px] overflow-y-auto" }}>
              <ListboxSection
                aria-label="Chat History Section"
                key="history-section"
                classNames={{
                  base: "py-0",
                  heading: "py-0 pl-[10px] text-small text-default-400",
                }}
              >
                {filteredHistory.map(renderChatItem)}
              </ListboxSection>
            </Listbox>
          )}
        </div>
      }
    />
  );
};

// Helper components to improve readability
const TitleEditInput = ({
  ref,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  ref: React.RefObject<HTMLInputElement | null>;
}) => (
  <input
    ref={ref}
    type="text"
    className="flex-1 bg-default-100 text-default-700 px-2 py-0.5 rounded-sm outline-none focus:ring-2 focus:ring-primary-400"
    {...props}
  />
);

interface ActionButtonsProps {
  chatId: string;
  hoveredItemId: string | null;
  deletingId: string | null;
  isPending: boolean;
  isCurrent: boolean;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

const ActionButtons = ({
  chatId,
  hoveredItemId,
  deletingId,
  isPending,
  isCurrent,
  onEdit,
  onDelete,
}: ActionButtonsProps) => (
  <div
    className={`flex gap-1 flex-row transition-opacity duration-150 ${
      hoveredItemId === chatId ? "opacity-100" : "opacity-0 hidden"
    }`}
  >
    {isCurrent && <span className="self-center">(current)</span>}
    <Tooltip content="Edit Title" placement="bottom" className="noselect" delay={500}>
      <Icon
        icon="tabler:pencil"
        width={24}
        className="dark:bg-default-50 rounded-md cursor-pointer hover:bg-default-200 p-[4px]"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(e);
        }}
      />
    </Tooltip>
    {/* Do not delete current conversation */}
    {!isCurrent && (
      <Tooltip content="Delete" placement="bottom" className="noselect" delay={500}>
        <button
          onClick={(e) => onDelete(chatId, e)}
          className="p-1 hover:bg-default-100 rounded"
          disabled={deletingId === chatId || isPending}
          style={{
            opacity: deletingId === chatId ? 0.5 : 1,
            cursor: deletingId === chatId ? "not-allowed" : "pointer",
          }}
        >
          {deletingId === chatId ? (
            <Icon icon="tabler:loader" className="animate-spin" width="16" />
          ) : (
            <Icon icon="tabler:trash" width="16" />
          )}
        </button>
      </Tooltip>
    )}
  </div>
);
