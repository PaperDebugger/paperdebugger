import { cn } from "@heroui/react";
import { ReactNode } from "react";

export function PdAppBodyContainer({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("pd-app-body-container", className)} {...props}>
      {children}
    </div>
  );
}
