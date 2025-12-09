import { Button } from "@heroui/react";

export const VariableInput = ({
  title,
  description,
  inputRef,
  value,
  setValue,
  verificationFunc,
}: {
  title: string;
  description: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  value: string;
  setValue: (value: string) => void;
  verificationFunc?: (value: string) => boolean;
}) => {
  return (
    <div className="flex flex-col gap-2 hover:bg-slate-200 rounded-md py-2 px-3 transition-all duration-300">
      <div className="flex flex-row gap-2 items-center">
        <label className="font-bold text-sm">{title}</label>
        {verificationFunc && (
          <Button size="sm" onPress={() => verificationFunc?.(value)}>
            verify
          </Button>
        )}
      </div>
      <div className="text-xs text-gray-500">{description}</div>
      <input
        className="border border-gray-200 rounded-md px-2 py-1"
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex flex-col gap-2 items-start text-xs text-gray-500 overflow-hidden text-ellipsis text-nowrap">
        current: {value}
      </div>
    </div>
  );
};
