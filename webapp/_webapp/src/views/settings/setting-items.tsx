import SwitchCell from "../../components/switch-cell";

type SettingItemProps = {
  label: string;
  description: string;
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
  isLoading?: boolean;
  isDisabled?: boolean;
  hidden?: boolean;
  className?: string;
  selected: boolean;
  onSelectChange: (selected: boolean) => void;
};

export const SettingItem = ({
  label,
  description,
  color,
  isLoading,
  isDisabled,
  hidden,
  className,
  selected,
  onSelectChange,
}: SettingItemProps) => (
  <SwitchCell
    classNames={{
      label: "text-sm",
      description: "text-xs",
      base: className,
    }}
    isSelected={selected}
    onValueChange={onSelectChange}
    description={description}
    label={label}
    color={color}
    isLoading={isLoading}
    isDisabled={isDisabled}
    hidden={hidden}
  />
);
