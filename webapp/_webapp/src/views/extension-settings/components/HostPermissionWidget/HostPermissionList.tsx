import { HostPermissionListItem } from "./HostPermissionListItem";
import { useHostPermissionStore } from "./useHostPermissionStore";

export const HostPermissionList = () => {
  const { permissions, isLoadingPermissions } = useHostPermissionStore();

  if (isLoadingPermissions) {
    return <p className="text-gray-500 text-sm">Loading permissions...</p>;
  }

  if (permissions.length === 0) {
    return (
      <div>
        <p className="text-gray-500 text-sm">No permissions granted yet.</p>
        <p className="text-gray-500 text-sm">Please request permission for the website you want to use.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {permissions.map((item) => (
        <HostPermissionListItem key={item.origin} item={item} />
      ))}
    </div>
  );
};
