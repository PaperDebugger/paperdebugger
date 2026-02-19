import { cn } from "@heroui/react";
import { useEffect, useReducer, useRef } from "react";
import googleAnalytics, { normalizeName } from "@/libs/google-analytics";
import { useAuthStore } from "@/stores/auth-store";
import { useConversationUiStore } from "@/stores/conversation/conversation-ui-store";
import { useSettingStore } from "@/stores/setting-store";

export type SelectionItem<T> = {
  title: string;
  subtitle?: string;
  description?: string;
  value: T;
  disabled?: boolean;
  disabledReason?: string;
};

type SelectionProps<T> = {
  items: SelectionItem<T>[];
  initialValue?: T;
  onSelect?: (item: SelectionItem<T>) => void;
  onClose?: () => void;
};

export function Selection<T>({ items, initialValue, onSelect, onClose }: SelectionProps<T>) {
  const { heightCollapseRequired } = useConversationUiStore();
  const { minimalistMode } = useSettingStore();
  const { user } = useAuthStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [{ selectedIdx, isKeyboardNavigation }, dispatchSelection] = useReducer(
    (
      state: { selectedIdx: number; isKeyboardNavigation: boolean },
      action:
        | { type: "SET_IDX"; idx: number }
        | { type: "SET_KEYBOARD_NAV"; value: boolean }
        | { type: "SET_IDX_WITH_KEYBOARD_NAV"; idx: number },
    ) => {
      switch (action.type) {
        case "SET_IDX":
          return { ...state, selectedIdx: action.idx };
        case "SET_KEYBOARD_NAV":
          return { ...state, isKeyboardNavigation: action.value };
        case "SET_IDX_WITH_KEYBOARD_NAV":
          return { selectedIdx: action.idx, isKeyboardNavigation: true };
        default:
          return state;
      }
    },
    { selectedIdx: 0, isKeyboardNavigation: false },
  );
  const setSelectedIdx = (idx: number) => dispatchSelection({ type: "SET_IDX", idx });
  const setIsKeyboardNavigation = (value: boolean) => dispatchSelection({ type: "SET_KEYBOARD_NAV", value });
  const itemCount = items?.length ?? 0;

  useEffect(() => {
    if (initialValue !== undefined) {
      const idx = items.findIndex((item) => item.value === initialValue);
      if (idx !== -1) {
        setSelectedIdx(idx);
        return;
      }
    }
    setSelectedIdx(0);
  }, [itemCount, initialValue, items]);

  // Handle click outside and Escape key to close
  useEffect(() => {
    if (!onClose) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (scrollContainerRef.current && !scrollContainerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    // Use mousedown to capture the event before focus changes
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    const scrollTo = (idx: number) => {
      const parent = scrollContainerRef.current;
      const children = parent?.getElementsByClassName("prompt-selection-item");
      const child = children?.[idx] as HTMLDivElement;
      if (!parent || !child) return;
      // Check if child is visible within parent's viewport, scroll if not
      const parentRect = parent.getBoundingClientRect();
      const childRect = child.getBoundingClientRect();
      if (childRect.top < parentRect.top) {
        // Element is above visible area
        parent.scrollTop -= parentRect.top - childRect.top;
      } else if (childRect.bottom > parentRect.bottom) {
        // Element is below visible area
        parent.scrollTop += childRect.bottom - parentRect.bottom;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        let nextIdx = selectedIdx + 1;
        // Skip disabled items
        while (nextIdx < itemCount && items[nextIdx]?.disabled) {
          nextIdx++;
        }
        if (nextIdx < itemCount) {
          scrollTo(nextIdx);
          dispatchSelection({ type: "SET_IDX_WITH_KEYBOARD_NAV", idx: nextIdx });
        } else {
          dispatchSelection({ type: "SET_KEYBOARD_NAV", value: true });
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        let prevIdx = selectedIdx - 1;
        // Skip disabled items
        while (prevIdx >= 0 && items[prevIdx]?.disabled) {
          prevIdx--;
        }
        if (prevIdx >= 0) {
          scrollTo(prevIdx);
          dispatchSelection({ type: "SET_IDX_WITH_KEYBOARD_NAV", idx: prevIdx });
        } else {
          dispatchSelection({ type: "SET_KEYBOARD_NAV", value: true });
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        dispatchSelection({ type: "SET_KEYBOARD_NAV", value: true });
        // Only select if not disabled
        if (!items[selectedIdx]?.disabled) {
          onSelect?.(items[selectedIdx]);
        }
      }
    };

    const handleMouseMove = () => {
      setIsKeyboardNavigation(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [items, onSelect, itemCount, selectedIdx, setSelectedIdx]);

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        "transition-all duration-100 absolute bottom-full left-0 right-0 mb-1 z-50 bg-white dark:!bg-default-100 shadow-lg",
        items && items.length > 0
          ? "rounded-lg border border-gray-200! dark:!border-default-200 overflow-y-auto"
          : "max-h-0",
        heightCollapseRequired || minimalistMode ? "p-0 max-h-[100px]" : "p-2 max-h-[200px]",
      )}
    >
      {items?.map((item, idx) => (
        <div
          key={`${item.title}-${item.subtitle ?? ""}-${item.description ?? ""}`}
          className={cn(
            "prompt-selection-item w-full flex flex-col rounded-lg",
            item.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            idx === selectedIdx && !item.disabled && "bg-gray-100 dark:!bg-default-200",
            heightCollapseRequired || minimalistMode ? "px-2 py-1" : "p-2",
          )}
          role="button"
          tabIndex={item.disabled ? -1 : 0}
          onClick={() => {
            if (item.disabled) return;
            googleAnalytics.fireEvent(user?.id, `select_${normalizeName(item.title)}`, {});
            onSelect?.(item);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              if (item.disabled) return;
              googleAnalytics.fireEvent(user?.id, `select_${normalizeName(item.title)}`, {});
              onSelect?.(item);
            }
          }}
          onMouseEnter={() => {
            if (!isKeyboardNavigation && !item.disabled) {
              setSelectedIdx(idx);
            }
          }}
        >
          <div
            className={cn(
              "font-semibold flex items-center gap-2",
              heightCollapseRequired || minimalistMode ? "text-[0.65rem]" : "text-xs",
            )}
          >
            <span>{item.title}</span>
            {item.disabled && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-3 h-3 text-gray-400"
              >
                <path
                  fillRule="evenodd"
                  d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {item.subtitle && (
              <span
                className={cn(
                  "text-gray-500 font-normal",
                  heightCollapseRequired || minimalistMode ? "text-[0.55rem]" : "text-[0.6rem]",
                )}
              >
                {item.subtitle}
              </span>
            )}
          </div>
          {(item.description || item.disabledReason) && (
            <div
              className="text-gray-500 text-nowrap whitespace-nowrap text-ellipsis overflow-hidden"
              style={{ fontSize: heightCollapseRequired || minimalistMode ? "0.5rem" : "0.65rem" }}
            >
              {item.disabledReason || item.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
