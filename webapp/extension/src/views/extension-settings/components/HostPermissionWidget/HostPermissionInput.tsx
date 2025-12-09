import { Button, Input } from "@heroui/react";
import React, { useCallback } from "react";
import { getMessageClassName, useHostPermissionStore } from "./useHostPermissionStore";

export const HostPermissionInput = () => {
  const { permissionUrl, setPermissionUrl, submitPermissionRequest, isSubmitting, message } = useHostPermissionStore();

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !isSubmitting) {
        submitPermissionRequest();
      }
    },
    [isSubmitting, submitPermissionRequest],
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
          value={permissionUrl}
          onChange={(e) => setPermissionUrl(e.target.value)}
          onKeyDown={handleKeyPress}
          classNames={{
            input: "font-mono",
          }}
        />
        <p className="mt-2">
          Example: <code>*://*.overleaf.com/*</code>{" "}
        </p>
        <p className="mt-1">
          Example: <code>*://sharelatex.gwdg.de/*</code>{" "}
        </p>
      </div>

      <div className="flex gap-3 mb-4">
        <Button onPress={submitPermissionRequest} disabled={isSubmitting} color="primary">
          {isSubmitting ? "Requesting..." : "Request Permission"}
        </Button>
      </div>

      {message && (
        <div className={`p-3 rounded-md text-sm mb-4 ${getMessageClassName(message.type)}`}>{message.text}</div>
      )}
    </>
  );
};
