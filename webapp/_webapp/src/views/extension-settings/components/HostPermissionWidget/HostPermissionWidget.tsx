import { HostPermissionForm } from "./HostPermissionForm";
import { HostPermissionList } from "./HostPermissionList";
import { useHostPermissionManager } from "./useHostPermissionManager";

export const HostPermissionWidget = () => {
  const {
    permissionUrl,
    setPermissionUrl,
    permissions,
    isSubmitting,
    message,
    isLoadingPermissions,
    submitPermissionRequest,
    getMessageClassName,
  } = useHostPermissionManager();

  return (
    <div className="border-b border-gray-200 pb-8 mb-8">
      <div className="text-lg font-semibold mb-2 text-gray-800">Host Permissions</div>
      <p className="text-gray-600 text-sm mb-5 leading-relaxed">
        Add your self-hosted Overleaf domain so PaperDebugger can interact with them.
      </p>
      <HostPermissionForm
        value={permissionUrl}
        onChange={setPermissionUrl}
        onSubmit={submitPermissionRequest}
        isSubmitting={isSubmitting}
        message={message}
        messageClassName={getMessageClassName}
      />

      <div className="mt-5">
        <HostPermissionList permissions={permissions} isLoading={isLoadingPermissions} />
      </div>
    </div>
  );
};

