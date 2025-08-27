import { cn } from "@heroui/react";
import { ReactNode } from "react";

export function PdAppSmallControlButton({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("pd-app-small-control-button", className)} {...props}>
      {children}
    </div>
  );
}
