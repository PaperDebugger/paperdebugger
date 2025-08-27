"use client";

/*
 * Switch-Cell component from Heroui.pro
 */

import type { SwitchProps } from "@heroui/react";

import React from "react";
import { extendVariants, Spinner, Switch } from "@heroui/react";
import { cn } from "@heroui/react";

const CustomSwitch = extendVariants(Switch, {
  variants: {
    color: {
      foreground: {
        wrapper: ["group-data-[selected=true]:bg-foreground", "group-data-[selected=true]:text-background"],
      },
    },
  },
});

export type SwitchCellProps = Omit<SwitchProps, "color"> & {
  label: string;
  description: string;
  color?: SwitchProps["color"] | "foreground";
  classNames?: SwitchProps["classNames"] & {
    description?: string | string[];
  };
  isLoading?: boolean;
};

const SwitchCell = React.forwardRef<HTMLInputElement, SwitchCellProps>(
  ({ label, description, classNames, isLoading, ...props }, ref) => (
    <CustomSwitch
      classNames={{
        ...classNames,
        base: cn(
          "inline-flex bg-content2 flex-row-reverse w-full max-w-full items-center",
          "justify-between cursor-pointer rounded-medium gap-2 !p-3",
          classNames?.base,
        ),
      }}
      thumbIcon={isLoading ? <Spinner style={{ zoom: 0.5 }} color="default" variant="gradient" /> : undefined}
      {...props}
    >
      <input ref={ref} type="checkbox" className="hidden" />
      <div className="flex flex-col">
        <p className={cn("text-medium", classNames?.label)}>{label}</p>
        <p className={cn("text-small text-default-500", classNames?.description)}>{description}</p>
      </div>
    </CustomSwitch>
  ),
);

SwitchCell.displayName = "SwitchCell";

export default SwitchCell;
