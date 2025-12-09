import { cn } from "@heroui/react";
import { ReactNode } from "react";

export function PdAppContainer({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("pd-app-container", className)} {...props}>
      {children}
    </div>
  );
}
