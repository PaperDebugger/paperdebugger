import { PromptLibraryHeader } from "./prompt-library-header";
import { PromptLibraryTable } from "./prompt-library-table";
import { PromptModal } from "./prompt-modal";
import { ProjectInstructions } from "./project-instructions";
import { UserInstructions } from "./user-instructions";
import { usePromptModal } from "./hooks/usePromptModal";
import { SettingsSectionContainer, SettingsSectionTitle } from "../settings/sections/components";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Tooltip } from "@heroui/react";

export function Prompts() {
  const { mode, selectedPrompt, isOpen, onOpen, onClose, onCreateOpen, onUpdateOpen, onViewOpen, onDeleteOpen } =
    usePromptModal();

  return (
    <div className="pd-app-tab-content">
      <PromptLibraryHeader />

      <div className="pd-app-tab-content-body">
        <SettingsSectionContainer>
          <div className="flex flex-row gap-2">
            <SettingsSectionTitle>Prompt Library</SettingsSectionTitle>
            <Tooltip content="Create New Prompt" placement="bottom" size="sm" delay={500}>
              <Icon
                icon="tabler:plus"
                className="w-4 h-4 text-gray-500 cursor-pointer hover:bg-gray-300 rounded-full transition-all duration-300"
                onClick={onCreateOpen}
              />
            </Tooltip>
          </div>
          <PromptLibraryTable onDelete={onDeleteOpen} onUpdate={onUpdateOpen} onView={onViewOpen} />
        </SettingsSectionContainer>

        <div className="flex flex-col mt-4">
          <ProjectInstructions />
          <UserInstructions />
        </div>
      </div>

      <PromptModal mode={mode} prompt={selectedPrompt} isOpen={isOpen} onOpenChange={onOpen} onClose={onClose} />
    </div>
  );
}
