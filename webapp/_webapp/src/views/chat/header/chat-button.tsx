import { cn, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";
import googleAnalytics, { normalizeName } from "../../../libs/google-analytics";
import { useAuthStore } from "../../../stores/auth-store";
import { useConversationUiStore } from "../../../stores/conversation/conversation-ui-store";
import { useSettingStore } from "../../../stores/setting-store";

type ChatButtonProps = {
  icon: string;
  text?: string;
  alt?: string;
  alwaysShowText?: boolean;
  noBorder?: boolean;
  disableAnimation?: boolean;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
  tooltip?: string;
  tooltipPlacement?: "top" | "bottom" | "left" | "right";
  tooltipSize?: "sm" | "md" | "lg";
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

export const ChatButton = ({
  icon,
  text,
  alt,
  alwaysShowText,
  noBorder,
  disableAnimation,
  className,
  onClick,
  disabled,
  variant = "default",
  tooltip,
  tooltipPlacement = "bottom",
  tooltipSize = "sm",
  onMouseDown,
}: ChatButtonProps) => {
  const { user } = useAuthStore();
  const [isHovered, setIsHovered] = useState(false);
  const showText = alwaysShowText || isHovered;
  const { heightCollapseRequired } = useConversationUiStore();
  const { minimalistMode } = useSettingStore();

  const content = (
    <div
      style={{ height: heightCollapseRequired || minimalistMode ? "16px" : "32px" }}
      className={cn(
        className,
        "rounded-full w-fit flex items-center cursor-pointer overflow-hidden",
        heightCollapseRequired || minimalistMode ? "px-0.5" : "px-2",
        noBorder ? "" : "border",
        disableAnimation ? "" : "transition-all duration-500",
        showText ? "max-w-full" : "max-w-[42px]",
        isHovered ? (variant === "danger" ? "bg-danger-50" : "bg-gray-100") : "",
        disabled ? "opacity-50" : "",
        variant === "danger" ? "text-danger" : "text-gray-500",
        variant === "danger" ? "border-danger-200" : "border-gray-200",
      )}
      onClick={() => {
        if (disabled) return;
        googleAnalytics.fireEvent(user?.id, "click_chat_button_" + normalizeName(text ?? alt ?? icon), {});
        onClick?.();
      }}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => !disabled && setIsHovered(false)}
      onMouseDown={onMouseDown}
    >
      <div className="flex items-center">
        <div className={cn("flex items-center justify-center")}>
          <Icon icon={icon} fontSize={heightCollapseRequired || minimalistMode ? 12 : 16} />
        </div>
        {text && (
          <span
            className={cn(
              "!text-xs !text-nowrap !overflow-hidden",
              disableAnimation ? "" : "!transition-all !duration-500",
              showText ? "!max-w-[300px] !ms-[4px] !opacity-100" : "!max-w-0 !ms-[0px] !opacity-0",
            )}
          >
            {text}
          </span>
        )}
      </div>
    </div>
  );
  return (
    <div className="rnd-cancel">
      {tooltip ? (
        <Tooltip content={tooltip} placement={tooltipPlacement} className="noselect" size={tooltipSize} delay={500}>
          {content}
        </Tooltip>
      ) : (
        content
      )}
    </div>
  );
};
