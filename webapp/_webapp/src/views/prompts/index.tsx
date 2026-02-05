import { PromptLibraryTable } from "./prompt-library-table";
import { PromptModal } from "./prompt-modal";
import { ProjectInstructions } from "./project-instructions";
import { UserInstructions } from "./user-instructions";
import { usePromptModal } from "./hooks/usePromptModal";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Tooltip } from "@heroui/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PanelHeader } from "@/components/app-shell/PanelHeader";
import { cn } from "@/lib/utils";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { Book } from "lucide-react";

export function Prompts() {
  const { mode, selectedPrompt, isOpen, onOpen, onClose, onCreateOpen, onUpdateOpen, onViewOpen, onDeleteOpen } =
    usePromptModal();
  const action = (
    <Tooltip content="Create New Prompt" placement="bottom" size="sm" delay={500}>
      <Icon
        icon="tabler:plus"
        className="w-[16px] h-[16px] text-gray-500 dark:text-default-400 cursor-pointer hover:bg-gray-300 dark:hover:bg-default-300 rounded-full transition-all duration-300"
        onClick={onCreateOpen}
      />
    </Tooltip>
  );

  return (
    <div className="pd-app-tab-content noselect">
      <div className="pd-app-tab-content-body">
        <div
          className={cn(
            "flex-1 overflow-hidden min-w-0 bg-foreground-2 shadow-middle rounded-l-[14px] rounded-r-[14px]",
          )}
        >
          <div className="h-full flex flex-col">
            <PanelHeader title="Prompts" />
            <div className="flex-1 min-h-0 mask-fade-y">
              <ScrollArea className="h-full">
                <div className="px-5 py-7 max-w-3xl mx-auto">
                  <div className="space-y-8">
                    <SettingsSection title="Prompt Library" icon={<Book className="w-4 h-4" />} action={action}>
                      <PromptLibraryTable onDelete={onDeleteOpen} onUpdate={onUpdateOpen} onView={onViewOpen} />
                    </SettingsSection>
                    <SettingsSection title="Project Instructions" icon={<Book className="w-4 h-4" />}>
                      <ProjectInstructions />
                    </SettingsSection>
                    <SettingsSection title="User Instructions" icon={<Book className="w-4 h-4" />}>
                      <UserInstructions />
                    </SettingsSection>
                    <PromptModal
                      mode={mode}
                      prompt={selectedPrompt}
                      isOpen={isOpen}
                      onOpenChange={onOpen}
                      onClose={onClose}
                    />
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
