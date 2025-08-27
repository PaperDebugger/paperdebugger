import { cn } from "@heroui/react";
import { ReactNode } from "react";

export function PdAppTabContentFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("pd-app-tab-content-footer noselect", className)} {...props}>
      {children}
    </div>
  );
}
