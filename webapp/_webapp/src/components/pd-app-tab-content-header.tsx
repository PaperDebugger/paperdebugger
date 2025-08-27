import { cn } from "@heroui/react";
import { ReactNode } from "react";

export function PdAppTabContentHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("pd-app-tab-content-header", className)} {...props}>
      {children}
    </div>
  );
}
