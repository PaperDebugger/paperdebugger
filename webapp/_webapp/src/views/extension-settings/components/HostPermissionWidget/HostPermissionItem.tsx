import { PermissionItem } from "./hostPermissionTypes";

interface HostPermissionItemProps {
  item: PermissionItem;
}

export const HostPermissionItem = ({ item }: HostPermissionItemProps) => {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md p-4 flex justify-between items-center">
      <div className="flex-1">
        <div className="font-medium mb-1 text-gray-900">Host Permission</div>
        <div className="font-mono text-sm text-blue-600">{item.origin}</div>
      </div>
      <div className="ml-4 px-2 py-1 bg-green-100 text-green-800 text-xs rounded font-medium">
        Granted
      </div>
    </div>
  );
};

