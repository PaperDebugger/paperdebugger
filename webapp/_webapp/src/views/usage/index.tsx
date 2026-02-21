import { Spinner, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState, useEffect } from "react";
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

const formatLastUpdated = (timestamp: number): string => {
  const diffMs = Date.now() - timestamp;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
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
  const {
    data: sessionData,
    isLoading: sessionLoading,
    dataUpdatedAt: sessionUpdatedAt,
    refetch: refetchSession,
    isFetching: sessionFetching,
  } = useGetSessionUsageQuery();
  const {
    data: weeklyData,
    isLoading: weeklyLoading,
    refetch: refetchWeekly,
    isFetching: weeklyFetching,
  } = useGetWeeklyUsageQuery();

  const [, setTick] = useState(0);

  // Update the "last updated" text periodically
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const isLoading = sessionLoading || weeklyLoading;
  const isFetching = sessionFetching || weeklyFetching;

  const handleRefresh = () => {
    refetchSession();
    refetchWeekly();
  };

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

        <div className="flex items-center justify-start gap-2 px-2 mt-2">
          <span className="text-xs text-default-400">
            Last updated: {formatLastUpdated(sessionUpdatedAt)}
          </span>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={handleRefresh}
            isLoading={isFetching}
            className="min-w-6 w-6 h-6"
          >
            <Icon icon="mdi:refresh" className="text-default-500" width={14} />
          </Button>
        </div>
      </div>
    </div>
  );
};
