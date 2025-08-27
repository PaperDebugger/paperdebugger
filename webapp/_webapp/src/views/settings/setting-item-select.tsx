import { Select, SelectItem } from "@heroui/react";

type SettingItemSelectProps = {
  label: string;
  description: string;
  className?: string;
  selected: string;
  options: Record<string, string>;
  onSelectChange: (selected: string) => void;
};

export const SettingItemSelect = ({
  label,
  description,
  className,
  selected,
  options,
  onSelectChange,
}: SettingItemSelectProps) => (
  <div className="flex flex-row gap-2 w-full bg-content2 rounded-medium p-2 items-center">
    <div className="flex flex-col gap-0 w-full pl-3 pt-1 pb-1">
      <p className="text-sm">{label}</p>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
    <Select
      size="sm"
      className={className}
      selectedKeys={[selected]}
      variant="flat"
      fullWidth={false}
      aria-label={label}
      onSelectionChange={(e) => {
        onSelectChange(e.currentKey ?? "");
      }}
    >
      {Object.entries(options).map(([key, value]) => (
        <SelectItem key={key}>{value}</SelectItem>
      ))}
    </Select>
  </div>
);
