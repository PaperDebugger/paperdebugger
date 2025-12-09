import { useCallback, useRef, useEffect, useState } from "react";
import { Button, cn } from "@heroui/react";
import { SettingsSectionContainer, SettingsSectionTitle } from "../settings/sections/components";
import { useGetUserInstructionsQuery, useUpsertUserInstructionsMutation } from "../../query/index";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../query/keys";

export function UserInstructions() {
  const userLevelPromptRef = useRef<HTMLTextAreaElement>(null);
  const [userLevelPrompt, setUserLevelPrompt] = useState<string>("");
  const [originalUserLevelPrompt, setOriginalUserLevelPrompt] = useState<string>("");

  const queryClient = useQueryClient();

  const { data: userInstructions } = useGetUserInstructionsQuery();

  const userInstructionsMutation = useUpsertUserInstructionsMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.getUserInstructions().queryKey });
      setOriginalUserLevelPrompt(userLevelPrompt);
    },
  });

  // Load existing instructions when data is available
  useEffect(() => {
    if (userInstructions?.instructions) {
      setUserLevelPrompt(userInstructions.instructions);
      setOriginalUserLevelPrompt(userInstructions.instructions);
    }
  }, [userInstructions]);

  // Auto-grow textarea functionality
  const adjustTextareaHeight = useCallback((textarea: HTMLTextAreaElement) => {
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.max(textarea.scrollHeight, 50)}px`; // Min height of ~5 rows
    }
  }, []);

  const handleUserLevelPromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setUserLevelPrompt(e.target.value);
      adjustTextareaHeight(e.target);
    },
    [adjustTextareaHeight],
  );

  const handleSaveUserInstructions = useCallback(() => {
    userInstructionsMutation.mutate({
      instructions: userLevelPrompt,
    });
  }, [userLevelPrompt, userInstructionsMutation]);

  // Check if there are unsaved changes
  const hasUserChanges = userLevelPrompt !== originalUserLevelPrompt;

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault(); // 阻止浏览器的默认保存行为
        if (hasUserChanges && !userInstructionsMutation.isPending) {
          handleSaveUserInstructions();
        }
      }
    },
    [hasUserChanges, userInstructionsMutation.isPending, handleSaveUserInstructions],
  );

  return (
    <SettingsSectionContainer>
      <SettingsSectionTitle>User Level Instructions</SettingsSectionTitle>
      <div className="space-y-2">
        <textarea
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          id="pd-chat-prompt-input-user"
          ref={userLevelPromptRef}
          className={cn(
            "flex-grow resize-none noselect focus:outline-none rnd-cancel px-2 py-1 border border-gray-200 rounded-md w-full",
          )}
          style={{
            fontSize: "12px",
            transition: "font-size 0.2s ease-in-out, height 0.1s ease",
            minHeight: "50px",
            overflow: "hidden",
          }}
          placeholder="User Level Instructions will be applied to all new conversations you create."
          value={userLevelPrompt}
          onChange={handleUserLevelPromptChange}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            color={hasUserChanges ? "primary" : "default"}
            variant={hasUserChanges ? "solid" : "bordered"}
            isDisabled={!hasUserChanges || userInstructionsMutation.isPending}
            isLoading={userInstructionsMutation.isPending}
            onPress={handleSaveUserInstructions}
          >
            Save
          </Button>
        </div>
      </div>
    </SettingsSectionContainer>
  );
}
