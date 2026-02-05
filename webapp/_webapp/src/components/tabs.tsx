import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";
import { useAuthStore } from "../stores/auth-store";
import { useSettingStore } from "../stores/setting-store";

export interface TabItem {
  /** Unique key for the tab */
  key: string;
  /** Display title */
  title: string;
  /** Icon component or element */
  icon: LucideIcon | React.ReactNode;
  /** Optional icon color (CSS color string) */
  iconColor?: string;
  /** Whether the icon responds to color (uses currentColor). Default true for Lucide icons. */
  iconColorable?: boolean;
  /** Tab content */
  children: React.ReactNode;
  /** Optional tooltip text */
  tooltip?: string;
  /** Optional badge (e.g., count) */
  label?: string;
  /** Disabled state */
  disabled?: boolean;
}

export interface TabsProps {
  /** Array of tab items */
  items: TabItem[];
  /** Controlled active tab key */
  activeKey?: string;
  /** Default active tab key (uncontrolled) */
  defaultActiveKey?: string;
  /** Callback when tab changes */
  onChange?: (key: string) => void;
  /** Custom className for the tabs container */
  className?: string;
  /** Custom className for the content area */
  contentClassName?: string;
}

/**
 * Tabs - Horizontal tab navigation with icon support
 *
 * Matches LeftSidebar styling for consistency:
 * - py-[5px] px-2 text-[13px] rounded-[6px]
 * - Icon: h-3.5 w-3.5
 *
 * Usage:
 * ```tsx
 * <Tabs
 *   items={[
 *     {
 *       key: "chat",
 *       title: "Chat",
 *       icon: <MessageSquare />,
 *       children: <Chat />,
 *       tooltip: "Chat",
 *     },
 *   ]}
 * />
 * ```
 */
export function Tabs({ items, activeKey, defaultActiveKey, onChange, className, contentClassName }: TabsProps) {
  // Uncontrolled state management
  const [internalActiveKey, setInternalActiveKey] = React.useState(defaultActiveKey || items[0]?.key);

  // Use controlled key if provided, otherwise use internal state
  const currentActiveKey = activeKey !== undefined ? activeKey : internalActiveKey;

  const handleTabClick = React.useCallback(
    (key: string, disabled?: boolean) => {
      if (disabled) return;

      if (activeKey === undefined) {
        setInternalActiveKey(key);
      }
      onChange?.(key);
    },
    [activeKey, onChange],
  );

  // Find active tab content
  const activeTab = items.find((item) => item.key === currentActiveKey);
  const { user } = useAuthStore();
  const { hideAvatar } = useSettingStore();
  return (
    <div className={cn("flex flex-row h-full", className)}>
      <div className="flex flex-col mt-[48px] items-center">
        {!hideAvatar && <Avatar name={user?.name || "User"} src={user?.picture} className="pd-avatar" />}
        {/* Tab Navigation - Vertical */}
        <nav
          className="flex flex-col gap-0.5 px-2 py-1 border-r border-foreground/5 mt-2 h-full"
          role="tablist"
          aria-label="Main navigation"
        >
          {items.map((item) => {
            const isActive = item.key === currentActiveKey;

            return (
              <TabButton
                key={item.key}
                item={item}
                isActive={isActive}
                onClick={() => handleTabClick(item.key, item.disabled)}
              />
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div
        className={cn("flex-1 overflow-auto", contentClassName)}
        role="tabpanel"
        aria-labelledby={`tab-${currentActiveKey}`}
      >
        {activeTab?.children}
      </div>
    </div>
  );
}

// ============================================================
// TabButton - Individual tab button component
// ============================================================

interface TabButtonProps {
  item: TabItem;
  isActive: boolean;
  onClick: () => void;
}

function TabButton({ item, isActive, onClick }: TabButtonProps) {
  return (
    <button
      id={`tab-${item.key}`}
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${item.key}`}
      disabled={item.disabled}
      onClick={onClick}
      title={item.tooltip}
      className={cn(
        "group flex items-center gap-2 rounded-[6px] text-[13px] select-none outline-none",
        "focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
        "py-[5px] px-2 transition-colors",
        isActive ? "bg-foreground/[0.07]" : "hover:bg-sidebar-hover",
        item.disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {/* Icon */}
      <span className="relative h-3.5 w-3.5 shrink-0 flex items-center justify-center">{renderIcon(item)}</span>

      {/* Title */}
      <span>{item.title}</span>

      {/* Label Badge */}
      {item.label && <span className="ml-1 text-xs text-foreground/30">{item.label}</span>}
    </button>
  );
}

// ============================================================
// Icon Rendering Helper
// ============================================================

/**
 * Helper to render icon - either component (function/forwardRef) or React element.
 * Colors are always applied via inline style.
 */
function renderIcon(item: TabItem) {
  const isComponent =
    typeof item.icon === "function" || (typeof item.icon === "object" && item.icon !== null && "render" in item.icon);

  // Default color for items without explicit iconColor (foreground at 60% opacity)
  const defaultColor = "color-mix(in oklch, var(--foreground) 60%, transparent)";

  // Lucide components are always colorable; ReactNode icons check iconColorable
  // Default to true for backwards compatibility (most icons are colorable)
  const applyColor = item.iconColorable !== false;
  const colorStyle = applyColor ? { color: item.iconColor || defaultColor } : undefined;

  if (isComponent) {
    const Icon = item.icon as React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    return <Icon className="h-3.5 w-3.5 shrink-0" style={colorStyle} />;
  }

  // Already a React element or primitive ReactNode
  const iconElement = item.icon as React.ReactNode;
  return (
    <span
      className="h-3.5 w-3.5 shrink-0 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
      style={colorStyle}
    >
      {iconElement}
    </span>
  );
}
