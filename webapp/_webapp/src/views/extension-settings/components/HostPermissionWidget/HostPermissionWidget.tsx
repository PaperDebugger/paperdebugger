import { useEffect } from "react";
import { HostPermissionInput } from "./HostPermissionInput";
import { HostPermissionList } from "./HostPermissionList";
import { useHostPermissionStore } from "./useHostPermissionStore";

export const HostPermissionWidget = () => {
  const { message, loadPermissions, clearMessage } = useHostPermissionStore();

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => clearMessage(), 5000);
    return () => clearTimeout(timer);
  }, [message, clearMessage]);

  return (
    <div className="border-b border-gray-200! pb-8 mb-8">
      <div className="text-lg font-semibold mb-2 text-gray-800">Host Permissions</div>
      <p className="text-gray-600 text-sm mb-5 leading-relaxed">
        Add your self-hosted Overleaf domain so PaperDebugger can interact with it.
      </p>
      <HostPermissionInput />

      <div className="mt-5">
        <HostPermissionList />
      </div>
    </div>
  );
};
