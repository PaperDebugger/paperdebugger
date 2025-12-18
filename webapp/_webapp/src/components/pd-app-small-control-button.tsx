import { cn } from "@heroui/react";
import { ReactNode } from "react";
import { useSettingStore } from "../stores/setting-store";

export function PdAppSmallControlButton({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const { minimalistMode } = useSettingStore();
  return (
    <div className={cn("pd-app-small-control-button", minimalistMode ? "!p-[0.1rem]" : "", className)} {...props}>
      {children}
    </div>
  );
}
