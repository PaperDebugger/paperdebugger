import { cn } from "@heroui/react";
import { ReactNode } from "react";

export function PdAppControlTitleBar({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("pd-app-control-title-bar", className)} {...props}>
      {children}
    </div>
  );
}
