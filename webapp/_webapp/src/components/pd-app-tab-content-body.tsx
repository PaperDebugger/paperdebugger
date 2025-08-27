import { cn } from "@heroui/react";
import { ReactNode } from "react";

export function PdAppTabContentBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("pd-app-tab-content-body", className)} {...props}>
      {children}
    </div>
  );
}
