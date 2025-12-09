/*
 * CellWrapper component from Heroui.pro
 */

import React from "react";
import { cn } from "@heroui/react";

const CellWrapper = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between gap-2 rounded-medium bg-content2 !p-3 !pr-[12px] !pl-[20px]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);

CellWrapper.displayName = "CellWrapper";

export default CellWrapper;
