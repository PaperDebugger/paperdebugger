import { Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react/dist/iconify.js";

export const SettingsSectionContainer = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex flex-col gap-2 w-full my-2 noselect">{children}</div>;
};

export const SettingsSectionTitle = ({ 
  children, 
  tooltip 
}: { 
  children: React.ReactNode;
  tooltip?: string;
}) => {
  return (
    <div className="flex flex-row items-center gap-1.5 text-gray-500 text-xs ps-2">
      <span>{children}</span>
      {tooltip && (
        <Tooltip content={tooltip} placement="right" size="sm" delay={500}>
          <Icon
            icon="tabler:help-circle"
            className="w-3.5 h-3.5 text-gray-400 cursor-help"
          />
        </Tooltip>
      )}
    </div>
  );
};
