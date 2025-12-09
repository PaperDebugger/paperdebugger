import { HostPermissionWidget } from "./HostPermissionWidget/HostPermissionWidget";

export const ExtensionSettings = () => {
    return (
        <div className="min-h-screen bg-gray-50 p-5">
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
                <h1 className="text-2xl font-semibold mb-2 text-gray-900">PaperDebugger Settings</h1>
                <HostPermissionWidget />
            </div>
        </div>
    );
};

