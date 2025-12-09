import { HostPermissionItem } from "./HostPermissionItem";
import { PermissionItem } from "./hostPermissionTypes";

interface HostPermissionListProps {
  permissions: PermissionItem[];
  isLoading: boolean;
}

export const HostPermissionList = ({ permissions, isLoading }: HostPermissionListProps) => {
  if (isLoading) {
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
        <HostPermissionItem key={item.origin} item={item} />
      ))}
    </div>
  );
};

