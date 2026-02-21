import { Spinner } from "@heroui/react";
import { TabHeader } from "../../components/tab-header";
import { useGetSessionUsageQuery, useGetWeeklyUsageQuery } from "../../query";
import CellWrapper from "../../components/cell-wrapper";

const formatNumber = (n: bigint | number | undefined): string => {
  if (n === undefined) return "0";
  return Number(n).toLocaleString();
};

const formatTimeRemaining = (timestamp: { seconds?: bigint; nanos?: number } | undefined): string => {
  if (!timestamp || !timestamp.seconds) return "";
  const expiryMs = Number(timestamp.seconds) * 1000;
  const nowMs = Date.now();
  const diffMs = expiryMs - nowMs;

  if (diffMs <= 0) return "";

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `resets in ${hours} hr ${minutes} min`;
  }
  return `resets in ${minutes} min`;
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
          <SectionTitle>
            Current Session
            {session?.sessionExpiry && (
              <span> ({formatTimeRemaining(session.sessionExpiry)})</span>
            )}
          </SectionTitle>
          {session ? (
            <CellWrapper>
              <div className="flex flex-col gap-2 w-full">
                <StatItem label="Tokens Used" value={formatNumber(session.totalTokens)} />
              </div>
            </CellWrapper>
          ) : (
            <CellWrapper>
              <div className="text-xs text-default-500 w-full text-center py-2">No active session</div>
            </CellWrapper>
          )}
        </SectionContainer>

        <SectionContainer>
          <SectionTitle>Weekly Limits</SectionTitle>
          {weekly ? (
            <CellWrapper>
              <div className="flex flex-col gap-2 w-full">
                <StatItem label="Tokens Used" value={formatNumber(weekly.totalTokens)} />
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
