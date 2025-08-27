import { cn } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import googleAnalytics, { normalizeName } from "../../../../libs/google-analytics";
import { useAuthStore } from "../../../../stores/auth-store";
import { useConversationUiStore } from "../../../../stores/conversation/conversation-ui-store";
import { useSettingStore } from "../../../../stores/setting-store";

export type SelectionItem<T> = {
  title: string;
  description: string;
  value: T;
};

type SelectionProps<T> = {
  items: SelectionItem<T>[];
  onSelect?: (item: SelectionItem<T>) => void;
};

export function Selection<T>({ items, onSelect }: SelectionProps<T>) {
  const { heightCollapseRequired } = useConversationUiStore();
  const { minimalistMode } = useSettingStore();
  const { user } = useAuthStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [isKeyboardNavigation, setIsKeyboardNavigation] = useState(false);
  const itemCount = items?.length ?? 0;

  useEffect(() => {
    setSelectedIdx(0);
  }, [itemCount]);

  useEffect(() => {
    const scrollTo = (idx: number) => {
      const parent = scrollContainerRef.current;
      const children = parent?.getElementsByClassName("prompt-selection-item");
      const child = children?.[idx] as HTMLDivElement;
      if (!parent || !child) return;
      // 判断 child 是否在 parent 可视区域内，如果不在则滚动
      const parentRect = parent.getBoundingClientRect();
      const childRect = child.getBoundingClientRect();
      if (childRect.top < parentRect.top) {
        // 元素在上方不可见
        parent.scrollTop -= parentRect.top - childRect.top;
      } else if (childRect.bottom > parentRect.bottom) {
        // 元素在下方不可见
        parent.scrollTop += childRect.bottom - parentRect.bottom;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        setIsKeyboardNavigation(true);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (selectedIdx < itemCount - 1) {
          scrollTo(selectedIdx + 1);
          setSelectedIdx(selectedIdx + 1);
        }
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        if (selectedIdx > 0) {
          scrollTo(selectedIdx - 1);
          setSelectedIdx(selectedIdx - 1);
        }
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onSelect?.(items[selectedIdx]);
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
        "transition-all duration-100",
        items && items.length > 0 ? "rounded-lg border border-gray-200 overflow-y-auto" : "max-h-[0px]",
        heightCollapseRequired || minimalistMode ? "p-0 max-h-[100px] mb-1" : "p-2 max-h-[200px]",
      )}
    >
      {items?.map((item, idx) => (
        <div
          key={item.description}
          className={cn(
            "prompt-selection-item w-full flex flex-col rounded-lg cursor-pointer",
            idx === selectedIdx && "bg-gray-100",
            heightCollapseRequired || minimalistMode ? "px-2 py-1" : "p-2",
          )}
          onClick={() => {
            googleAnalytics.fireEvent(user?.id, `select_${normalizeName(item.title)}`, {});
            onSelect?.(item);
          }}
          onMouseEnter={() => {
            if (!isKeyboardNavigation) {
              setSelectedIdx(idx);
            }
          }}
        >
          <div className={cn("font-semibold", heightCollapseRequired || minimalistMode ? "text-[0.65rem]" : "text-xs")}>
            {item.title}
          </div>
          <div
            className="text-gray-500 text-nowrap whitespace-nowrap text-ellipsis overflow-hidden"
            style={{ fontSize: heightCollapseRequired || minimalistMode ? "0.5rem" : "0.65rem" }}
          >
            {item.description}
          </div>
        </div>
      ))}
    </div>
  );
}
