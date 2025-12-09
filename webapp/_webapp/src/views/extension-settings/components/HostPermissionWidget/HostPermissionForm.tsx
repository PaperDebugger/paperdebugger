import { Button, Input } from "@heroui/react";
import React, { useCallback } from "react";
import { PermissionMessage } from "./hostPermissionTypes";

interface HostPermissionFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  message: PermissionMessage | null;
  messageClassName: (type: PermissionMessage["type"]) => string;
}

export const HostPermissionForm = ({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  message,
  messageClassName,
}: HostPermissionFormProps) => {
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !isSubmitting) {
        onSubmit();
      }
    },
    [isSubmitting, onSubmit],
  );

  return (
    <>
      <div className="mb-4">
        <Input
          label="Website URL:"
          variant="bordered"
          color="primary"
          radius="sm"
          placeholder="https://www.example.com/ or https://*.example.com/*"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          classNames={{
            input: "font-mono",
          }}
        />
        <p className="mt-2">Example: <code>*://*.overleaf.com/*</code> </p>
        <p className="mt-1">Example: <code>*://sharelatex.gwdg.de/*</code> </p>
      </div>

      <div className="flex gap-3 mb-4">
        <Button onPress={onSubmit} disabled={isSubmitting} color="primary">
          {isSubmitting ? "Requesting..." : "Request Permission"}
        </Button>
      </div>

      {message && (
        <div className={`p-3 rounded-md text-sm mb-4 ${messageClassName(message.type)}`}>
          {message.text}
        </div>
      )}
    </>
  );
};

