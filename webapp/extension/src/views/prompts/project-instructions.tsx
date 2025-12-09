import { useCallback, useRef, useEffect, useState } from "react";
import { Button, cn } from "@heroui/react";
import { SettingsSectionContainer, SettingsSectionTitle } from "../settings/sections/components";
import { useGetProjectInstructionsQuery, useUpsertProjectInstructionsMutation } from "../../query/index";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../query/keys";
import { getProjectId } from "../../libs/helpers";

export function ProjectInstructions() {
  const projectInstructionRef = useRef<HTMLTextAreaElement>(null);
  const [projectInstruction, setProjectInstruction] = useState<string>("");
  const [originalProjectInstruction, setOriginalProjectInstruction] = useState<string>("");

  const projectId = getProjectId();
  const queryClient = useQueryClient();

  const { data: projectInstructions } = useGetProjectInstructionsQuery(projectId, {
    enabled: !!projectId,
  });

  const projectInstructionsMutation = useUpsertProjectInstructionsMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.getProjectInstructions(projectId).queryKey,
      });
      setOriginalProjectInstruction(projectInstruction);
    },
  });

  // Load existing instructions when data is available
  useEffect(() => {
    if (projectInstructions?.instructions) {
      setProjectInstruction(projectInstructions.instructions);
      setOriginalProjectInstruction(projectInstructions.instructions);
    }
  }, [projectInstructions]);

  // Auto-grow textarea functionality
  const adjustTextareaHeight = useCallback((textarea: HTMLTextAreaElement) => {
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.max(textarea.scrollHeight, 50)}px`; // Min height of ~5 rows
    }
  }, []);

  const handleProjectInstructionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setProjectInstruction(e.target.value);
      adjustTextareaHeight(e.target);
    },
    [adjustTextareaHeight],
  );

  const handleSaveProjectInstructions = useCallback(() => {
    if (projectId) {
      projectInstructionsMutation.mutate({
        projectId,
        instructions: projectInstruction,
      });
    }
  }, [projectId, projectInstruction, projectInstructionsMutation]);

  // Check if there are unsaved changes
  const hasProjectChanges = projectInstruction !== originalProjectInstruction;

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault(); // 阻止浏览器的默认保存行为
        if (hasProjectChanges && !projectInstructionsMutation.isPending) {
          handleSaveProjectInstructions();
        }
      }
    },
    [hasProjectChanges, projectInstructionsMutation.isPending, handleSaveProjectInstructions],
  );

  return (
    <SettingsSectionContainer>
      <SettingsSectionTitle>Project Level Instructions</SettingsSectionTitle>
      <div className="space-y-2">
        <textarea
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          id="pd-chat-prompt-input-project"
          ref={projectInstructionRef}
          className={cn(
            "flex-grow resize-none noselect focus:outline-none rnd-cancel px-2 py-1 border border-gray-200 rounded-md w-full",
          )}
          style={{
            fontSize: "12px",
            transition: "font-size 0.2s ease-in-out, height 0.1s ease",
            minHeight: "50px",
            overflow: "hidden",
          }}
          placeholder="Project Level Instructions will be applied to new conversations in this project."
          value={projectInstruction}
          onChange={handleProjectInstructionChange}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            color={hasProjectChanges ? "primary" : "default"}
            variant={hasProjectChanges ? "solid" : "bordered"}
            isDisabled={!hasProjectChanges || projectInstructionsMutation.isPending}
            isLoading={projectInstructionsMutation.isPending}
            onPress={handleSaveProjectInstructions}
          >
            Save
          </Button>
        </div>
      </div>
    </SettingsSectionContainer>
  );
}
