import { useState } from "react";
import { Card, CardBody, Button, ScrollShadow, Divider, Chip, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ReportsHeader } from "./reports-header";
import apiclient from "../../libs/apiclient";
import { getProjectId } from "../../libs/helpers";
import { processStream } from "../../query/utils";
import { RunL0CheckResponseSchema, CheckResult } from "../../pkg/gen/apiclient/compliance/v1/compliance_pb";

export const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [activeLevel, setActiveLevel] = useState<string | null>(null);

  const runL0Check = async () => {
    setLoading(true);
    setProgress(0);
    try {
      const projectId = getProjectId();
      const stream = await apiclient.postStream(`/projects/${projectId}/compliance/l0-check`, {});
      
      await processStream(stream, RunL0CheckResponseSchema, (data: any) => {
        if (data.payload.case === "progress") {
          setProgress(Math.round(data.payload.value * 100));
        } else if (data.payload.case === "results") {
          setResults(data.payload.value.results);
          setActiveLevel("L0");
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResults(null);
    setActiveLevel(null);
    setProgress(0);
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "high": return "danger";
      case "med": return "warning";
      case "low": return "success";
      default: return "default";
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case "high": return "tabler:alert-circle";
      case "med": return "tabler:alert-triangle";
      case "low": return "tabler:circle-check";
      default: return "tabler:info-circle";
    }
  };

  if (loading) {
    return (
      <div className="pd-app-tab-content noselect !min-w-[400px]">
        <ReportsHeader />
        <div className="pd-app-tab-content-body flex flex-col items-center justify-center h-[400px] gap-8 bg-white px-12">
          <div className="w-full max-w-md flex flex-col gap-3">
            <div className="flex justify-between items-end mb-1">
                <p className="text-blue-600 font-bold text-sm tracking-tight">AUDIT IN PROGRESS</p>
                <p className="text-gray-400 font-mono text-xs">{progress}%</p>
            </div>
            <Progress 
                size="md" 
                value={progress} 
                color="primary" 
                showValueLabel={false}
                className="max-w-md"
            />
            <p className="text-gray-400 text-xs text-center mt-2 animate-pulse">
                Checking project files against L0 compliance standards...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (activeLevel === "L0" && results) {
    return (
      <div className="pd-app-tab-content noselect !min-w-[400px]">
        <ReportsHeader />
        <div className="pd-app-tab-content-body flex flex-col bg-white h-full relative">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3 sticky top-0 bg-white/80 backdrop-blur-md z-10">
            <Button isIconOnly variant="light" size="sm" onClick={reset}>
               <Icon icon="tabler:arrow-left" fontSize={20} />
            </Button>
            <h2 className="font-bold text-lg text-gray-800">L0 Compliance Report</h2>
            <Chip size="sm" color="primary" variant="flat" className="ml-auto">BETA</Chip>
          </div>
          
          <ScrollShadow className="flex-1 p-6">
            <div className="flex flex-col gap-6">
              {results.length === 0 ? (
                <div className="text-center py-10">
                  <Icon icon="tabler:circle-check" className="text-success text-6xl mx-auto mb-4" />
                  <p className="text-xl font-bold text-gray-800">Perfect Compliance!</p>
                  <p className="text-gray-500 mt-2">No L0 issues were detected in your project.</p>
                </div>
              ) : (
                results.map((res) => (
                  <div key={res.metricId} className="flex flex-col gap-3 group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl bg-${getLevelColor(res.level)}-100 text-${getLevelColor(res.level)}-600`}>
                          <Icon icon={getLevelIcon(res.level)} fontSize={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">{res.name || res.metricId}</h4>
                          <p className="text-xs text-gray-400 font-mono uppercase">{res.metricId}</p>
                        </div>
                      </div>
                      <Chip size="sm" color={getLevelColor(res.level)} variant="flat" className="capitalize">
                        {res.level}
                      </Chip>
                    </div>
                    
                    <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      {res.notes}
                    </p>

                    {res.evidence && res.evidence.length > 0 && (
                      <div className="ml-4 flex flex-col gap-2 border-l-2 border-gray-100 pl-4 py-1">
                        {res.evidence.map((ev, i) => (
                          <div key={i} className="text-xs text-gray-500">
                            <span className="font-bold text-gray-700">{ev.section}:</span> {ev.reason}
                            {ev.quote && (
                                <div className="mt-1 bg-gray-50/50 p-2 rounded italic text-gray-400 border-l border-gray-200">
                                    "{ev.quote}"
                                </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <Divider className="mt-2 opacity-50 group-last:hidden" />
                  </div>
                ))
              )}
            </div>
            {/* Attribution footer */}
            <div className="py-12 text-center">
                <p className="text-xs text-gray-300">Compliance Audit powered by PaperDebugger L0 Engine</p>
            </div>
          </ScrollShadow>
        </div>
      </div>
    );
  }

  return (
    <div className="pd-app-tab-content noselect !min-w-[400px]">
          <ReportsHeader />
          <div className="pd-app-tab-content-body">

      
        <div className="pd-app-tab-content-body p-6 flex flex-col gap-4 bg-white h-full">
            <Card isPressable className="border border-gray-100 shadow-sm bg-gray-50/30 hover:bg-gray-50 transition-all duration-300 ring-0 hover:ring-2 hover:ring-blue-500/20" onClick={runL0Check}>
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

            <Card isPressable className="border border-gray-100 shadow-sm bg-gray-50/30 hover:bg-gray-50 transition-all duration-300 opacity-60">
            <CardBody className="flex flex-row items-center gap-4 p-6">
                <div className="p-3 bg-purple-100/50 text-purple-600 rounded-2xl shadow-sm">
                <Icon icon="tabler:brain" fontSize={28} />
                </div>
                <div className="flex-1 text-left">
                <h3 className="font-bold text-lg text-gray-800">L1 Check</h3>
                <p className="text-sm text-gray-500 mt-0.5">Deep semantic analysis and research logic audit.</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <Icon icon="tabler:lock" className="text-gray-400" />
                    <span className="text-[10px] text-gray-400 font-bold">L1 is Locked</span>
                </div>
            </CardBody>
            </Card>

            <div className="mt-auto py-8 text-center text-gray-300">
                <Icon icon="tabler:shield-check" className="mx-auto mb-2 opacity-50" fontSize={24} />
                <p className="text-[10px] font-bold tracking-widest uppercase">PaperDebugger Compliance System</p>
            </div>
        </div>
    </div>
    </div>
  );
};
