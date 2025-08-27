import { cn } from "@heroui/react";
import { ReactNode } from "react";

export function PdAppTabItems({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("pd-app-tab-items", className)} {...props}>
      {children}
    </div>
  );
}
