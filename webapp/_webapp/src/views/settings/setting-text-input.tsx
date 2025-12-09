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
};

export function createSettingsTextInput<K extends SettingKey>(settingKey: K) {
  return function SettingsTextInput({
    label,
    placeholder,
    description,
    rows = 3,
    className,
    multiline = true,
  }: SettingsTextInputProps) {
  const { settings, isUpdating, updateSettings } = useSettingStore();
  const [value, setValue] = useState<string>("");
  const [originalValue, setOriginalValue] = useState<string>("");

  // Load existing value when settings are available
  useEffect(() => {
    const settingValue = settings?.[settingKey];
    if (settingValue !== undefined) {
      const stringValue = String(settingValue || "");
      setValue(stringValue);
      setOriginalValue(stringValue);
    }
  }, [settings, settingKey]);

  const valueChanged = value !== originalValue;

  const saveSettings = useCallback(async () => {
    await updateSettings({ [settingKey]: value } as Partial<PlainMessage<Settings>>);
    setOriginalValue(value);
  }, [value, updateSettings, settingKey]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault(); // 阻止浏览器的默认保存行为
        if (valueChanged && !isUpdating[settingKey]) {
          saveSettings();
        }
      }
    },
    [valueChanged, isUpdating, settingKey, saveSettings],
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

  return (
    <div className="space-y-2">
      {(label || description) && (
        <div className="space-y-1">
          {label && <div className="text-sm font-medium">{label}</div>}
          {description && <div className="text-xs text-default-500">{description}</div>}
        </div>
      )}
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
        />
      ) : (
        <input
          type="text"
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          className={inputClassName}
          style={inputStyle}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      <div className="flex justify-end">
        <Button
          size="sm"
          color={valueChanged ? "primary" : "default"}
          variant={valueChanged ? "solid" : "bordered"}
          isDisabled={!valueChanged || isUpdating[settingKey]}
          isLoading={isUpdating[settingKey]}
          onPress={saveSettings}
        >
          Save
        </Button>
      </div>
    </div>
  );
  };
}

