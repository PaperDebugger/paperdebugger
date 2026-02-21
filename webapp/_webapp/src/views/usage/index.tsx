import { Spinner } from "@heroui/react";
import { TabHeader } from "../../components/tab-header";
import { useGetSessionUsageQuery, useGetWeeklyUsageQuery } from "../../query";
import CellWrapper from "../../components/cell-wrapper";

const formatNumber = (n: bigint | number | undefined): string => {
  if (n === undefined) return "0";
  return Number(n).toLocaleString();
};

const formatDate = (timestamp: { seconds?: bigint; nanos?: number } | undefined): string => {
  if (!timestamp || !timestamp.seconds) return "N/A";
  const date = new Date(Number(timestamp.seconds) * 1000);
  return date.toLocaleString();
};

const SectionContainer = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex flex-col gap-2 w-full my-2 noselect">{children}</div>;
};

const SectionTitle = ({ children }: { children: React.ReactNode }) => {
  return <div className="text-gray-500 text-xs ps-2">{children}</div>;
};

const StatItem = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-default-500">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
};

export const Usage = () => {
  const { data: sessionData, isLoading: sessionLoading } = useGetSessionUsageQuery();
  const { data: weeklyData, isLoading: weeklyLoading } = useGetWeeklyUsageQuery();

  const isLoading = sessionLoading || weeklyLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center w-full h-full">
        <Spinner color="default" variant="gradient" />
      </div>
    );
  }

  const session = sessionData?.session;
  const weekly = weeklyData?.usage;

  return (
    <div className="pd-app-tab-content noselect !min-w-[400px]">
      <TabHeader title="Usage" />
      <div className="pd-app-tab-content-body">
        <SectionContainer>
          <SectionTitle>Current Session</SectionTitle>
          {session ? (
            <CellWrapper>
              <div className="flex flex-col gap-2 w-full">
                <StatItem label="Session Start" value={formatDate(session.sessionStart)} />
                <StatItem label="Session Expiry" value={formatDate(session.sessionExpiry)} />
                <div className="border-t border-default-200 my-1" />
                <StatItem label="Prompt Tokens" value={formatNumber(session.promptTokens)} />
                <StatItem label="Completion Tokens" value={formatNumber(session.completionTokens)} />
                <StatItem label="Total Tokens" value={formatNumber(session.totalTokens)} />
                <StatItem label="Requests" value={formatNumber(session.requestCount)} />
              </div>
            </CellWrapper>
          ) : (
            <CellWrapper>
              <div className="text-xs text-default-500 w-full text-center py-2">No active session</div>
            </CellWrapper>
          )}
        </SectionContainer>

        <SectionContainer>
          <SectionTitle>Weekly Summary</SectionTitle>
          {weekly ? (
            <CellWrapper>
              <div className="flex flex-col gap-2 w-full">
                <StatItem label="Prompt Tokens" value={formatNumber(weekly.promptTokens)} />
                <StatItem label="Completion Tokens" value={formatNumber(weekly.completionTokens)} />
                <StatItem label="Total Tokens" value={formatNumber(weekly.totalTokens)} />
                <div className="border-t border-default-200 my-1" />
                <StatItem label="Total Requests" value={formatNumber(weekly.requestCount)} />
                <StatItem label="Total Sessions" value={formatNumber(weekly.sessionCount)} />
              </div>
            </CellWrapper>
          ) : (
            <CellWrapper>
              <div className="text-xs text-default-500 w-full text-center py-2">No usage data available</div>
            </CellWrapper>
          )}
        </SectionContainer>
      </div>
    </div>
  );
};
