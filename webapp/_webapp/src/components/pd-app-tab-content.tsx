import { cn } from "@heroui/react";
import { ReactNode } from "react";

export function PdAppTabContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("pd-app-tab-content", className)} {...props}>
      {children}
    </div>
  );
}
