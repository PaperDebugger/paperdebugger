import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ReportsHeader } from "./reports-header";


export const Reports = () => {
  return (
    <div className="pd-app-tab-content noselect !min-w-[400px]">
          <ReportsHeader />
          <div className="pd-app-tab-content-body">

      
        <div className="pd-app-tab-content-body p-6 flex flex-col gap-4 bg-white">
            <Card isPressable className="border border-gray-100 shadow-sm bg-gray-50/30 hover:bg-gray-50 transition-all duration-300">
            <CardBody className="flex flex-row items-center gap-4 p-6">
                <div className="p-3 bg-blue-100/50 text-blue-600 rounded-2xl shadow-sm">
                <Icon icon="tabler:list-check" fontSize={28} />
                </div>
                <div className="flex-1 text-left">
                <h3 className="font-bold text-lg text-gray-800">L0 Check</h3>
                <p className="text-sm text-gray-500 mt-0.5">Basic format, word count, and metadata validation.</p>
                </div>
                <Icon icon="tabler:chevron-right" className="text-gray-400" />
            </CardBody>
            </Card>

            <Card isPressable className="border border-gray-100 shadow-sm bg-gray-50/30 hover:bg-gray-50 transition-all duration-300">
            <CardBody className="flex flex-row items-center gap-4 p-6">
                <div className="p-3 bg-purple-100/50 text-purple-600 rounded-2xl shadow-sm">
                <Icon icon="tabler:brain" fontSize={28} />
                </div>
                <div className="flex-1 text-left">
                <h3 className="font-bold text-lg text-gray-800">L1 Check</h3>
                <p className="text-sm text-gray-500 mt-0.5">Deep semantic analysis and research logic audit.</p>
                </div>
                <Icon icon="tabler:chevron-right" className="text-gray-400" />
            </CardBody>
            </Card>
        </div>
    </div>
    </div>
  );
};
