import { Button, cn } from "@heroui/react";

type SettingItemInputProps = {
  label: string;
  description: string;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  showResetButton?: boolean;
  onReset?: () => void;
};

export const SettingItemInput = ({
  label,
  description,
  className,
  value,
  onChange,
  showResetButton,
  onReset,
}: SettingItemInputProps) => (
  <div className="flex flex-row gap-2 w-full bg-content2 rounded-medium p-2 items-center">
    <div className="flex flex-col gap-0 w-full pl-3 pt-1 pb-1">
      <p className="text-sm">{label}</p>
      <div className="flex flex-row gap-2">
        <input
          className={cn(className, "w-full text-xs bg-transparent p-2 rnd-cancel border border-gray-200 rounded-md")}
          aria-label={label}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
        {showResetButton && (
          <Button size="sm" variant="light" className="rounded-md" onPress={onReset}>
            Reset
          </Button>
        )}
      </div>
      <p className="text-xs text-gray-500">Current Value: {value}</p>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  </div>
);
