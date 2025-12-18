import { useCallback, useEffect, useState } from "react";
import { Button, cn } from "@heroui/react";
import { useSettingStore } from "../../stores/setting-store";
import { Settings } from "../../pkg/gen/apiclient/user/v1/user_pb";
import { PlainMessage } from "../../query/types";

type SettingKey = keyof PlainMessage<Settings>;

type SettingsTextInputProps = {
  label?: string;
  placeholder?: string;
  description?: string;
  rows?: number;
  className?: string;
  multiline?: boolean;
  password?: boolean;
};

export function createSettingsTextInput<K extends SettingKey>(settingKey: K) {
  return function SettingsTextInput({
    label,
    placeholder,
    description,
    rows = 3,
    className,
    multiline = true,
    password = false,
  }: SettingsTextInputProps) {
    const { settings, isUpdating, updateSettings } = useSettingStore();
    const [value, setValue] = useState<string>("");
    const [originalValue, setOriginalValue] = useState<string>("");
    const [isEditing, setIsEditing] = useState<boolean>(false);

    // Load existing value when settings are available
    useEffect(() => {
      const settingValue = settings?.[settingKey];
      if (settingValue !== undefined) {
        const stringValue = String(settingValue || "");
        setValue(stringValue);
        setOriginalValue(stringValue);
      }
    }, [settings]); // settingKey is an outer scope value, not a dependency

    const valueChanged = value !== originalValue;

    const saveSettings = useCallback(async () => {
      await updateSettings({ [settingKey]: value.trim() } as Partial<PlainMessage<Settings>>);
      setOriginalValue(value.trim());
      setIsEditing(false);
    }, [value, updateSettings]); // settingKey is an outer scope value, not a dependency

    const handleEdit = useCallback(() => {
      setIsEditing(true);
    }, []);

    const handleCancel = useCallback(() => {
      setValue(originalValue.trim());
      setIsEditing(false);
    }, [originalValue]);

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "s") {
          e.preventDefault(); // 阻止浏览器的默认保存行为
          if (valueChanged && !isUpdating[settingKey]) {
            saveSettings();
          }
        }
        if (e.key === "Escape") {
          handleCancel();
        }
      },
      [valueChanged, isUpdating, saveSettings, handleCancel], // settingKey is an outer scope value, not a dependency
    );

    const inputClassName = cn(
      "flex-grow resize-none noselect focus:outline-none rnd-cancel px-2 py-1 border border-gray-200 rounded-md w-full",
      className,
    );

    const inputStyle = {
      fontSize: "12px",
      transition: "font-size 0.2s ease-in-out, height 0.1s ease",
      minHeight: multiline ? `${rows * 20}px` : "32px",
      overflow: multiline ? "hidden" : "visible",
    };

    const textDisplayClassName = cn(
      "px-2 py-1 text-xs whitespace-pre-wrap break-words min-h-[32px] bg-gray-100 rounded-md content-center",
      !value && "text-default-400 italic",
    );

    return (
      <div className="space-y-0 mt-2">
        <div className="flex flex-row gap-2 items-center mb-1">
          {label && <div className="text-xs font-medium">{label}</div>}
          {description && <div className="text-xs text-default-500">{description}</div>}
        </div>
        {isEditing ? (
          <div className="flex items-start gap-2">
            {multiline ? (
              <textarea
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
                className={inputClassName}
                style={inputStyle}
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={rows}
                autoFocus
              />
            ) : (
              <input
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
                className={inputClassName}
                style={inputStyle}
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
              />
            )}
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="bordered" onPress={handleCancel} isDisabled={isUpdating[settingKey]}>
                Cancel
              </Button>
              <Button
                size="sm"
                color="primary"
                variant="solid"
                isDisabled={!valueChanged || isUpdating[settingKey]}
                isLoading={isUpdating[settingKey]}
                onPress={saveSettings}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className={cn(textDisplayClassName, "flex-grow")}>
              {password && value.trim().length > 0
                ? "•".repeat(16)
                : value.trim() || placeholder?.trim() || "No value set"}
            </div>
            <Button size="sm" variant="bordered" onPress={handleEdit} className="shrink-0">
              Edit
            </Button>
          </div>
        )}
      </div>
    );
  };
}
