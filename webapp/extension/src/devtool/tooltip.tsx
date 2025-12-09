import { useEffect, useState } from "react";

import { useRef } from "react";
import { useSelectionStore } from "../stores/selection-store";

export const TooltipArea = ({ children }: { children: React.ReactNode }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);

  const tooltipRef = useRef<HTMLButtonElement>(null);
  const { selectedText, setSelectedText, setSelectionRange } = useSelectionStore();

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const text = selection.toString();
        if (text.trim().length > 0) {
          setSelectedText(text);
          setSelectionRange(range);
          setTooltipPosition({
            left: rect.left + rect.width / 2 + window.scrollX,
            top: rect.bottom + window.scrollY + 8, // 8px below selection
          });
          setShowTooltip(true);
          return;
        }
      }
      setShowTooltip(false);
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [selectedText, setSelectedText, setSelectionRange]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (tooltipRef.current && e.target instanceof Node && tooltipRef.current.contains(e.target)) {
        return;
      }
      setShowTooltip(false);
    };
    if (showTooltip) {
      document.addEventListener("mousedown", handleClick);
    } else {
      document.removeEventListener("mousedown", handleClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [showTooltip]);

  return (
    <div>
      <div>
        {showTooltip && tooltipPosition && (
          <div
            className="review-tooltip-menu fixed z-50 flex flex-row gap-1"
            style={{
              left: tooltipPosition.left,
              top: tooltipPosition.top,
              transform: "translate(-50%, 0)",
            }}
          >
            <button
              ref={tooltipRef}
              className="review-tooltip-menu-button"
              onClick={() => {
                // eslint-disable-next-line no-console
                console.log(selectedText);
              }}
            >
              Comment
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
