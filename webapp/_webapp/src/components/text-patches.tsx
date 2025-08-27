import { Button } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { diffWords } from "diff";
import { applyChanges, getProjectId } from "../libs/helpers";
import { useSelectionStore } from "../stores/selection-store";
import googleAnalytics from "../libs/google-analytics";
import { useAuthStore } from "../stores/auth-store";

type TextPatchesProps = {
  attachment?: string;
  children: React.ReactNode;
};

// Attachment is actually the comparing candidate.
export function TextPatches({ attachment, children }: TextPatchesProps) {
  const { user } = useAuthStore();
  const { selectionRange, setSelectionRange } = useSelectionStore();
  const preRef = useRef<HTMLPreElement>(null);

  const [insertBtnText, setInsertBtnText] = useState("Insert");
  const [copyBtnText, setCopyBtnText] = useState("Copy");
  const [mappedNodes, setMappedNodes] = useState<React.ReactNode[]>([]);
  const [showDiff, setShowDiff] = useState(false);

  const copyText = useCallback(() => {
    if (preRef.current) {
      navigator.clipboard.writeText(preRef.current.innerText ?? "");
      setCopyBtnText("Copied!");
      setTimeout(() => {
        setCopyBtnText("Copy");
      }, 1500);
    }
  }, [preRef]);

  const applyText = useCallback(() => {
    if (preRef.current && selectionRange) {
      applyChanges(preRef.current.innerText, selectionRange);
      setSelectionRange(null);
      setInsertBtnText("Applied!");
      setTimeout(() => {
        setInsertBtnText("Insert");
      }, 1500);
    }
  }, [preRef, selectionRange, setSelectionRange]);

  // Process children to handle newlines
  let processedChildren = children;
  if (Array.isArray(processedChildren)) {
    processedChildren = processedChildren.map((child) => {
      return typeof child === "string" ? child.replace(/§NEWLINE§/g, "\n").trim() : child;
    });
  }

  useEffect(() => {
    if (!preRef.current) return;

    const diff = diffWords(attachment ?? "", preRef.current?.innerText ?? "");

    let cntAdded = 0;
    let cntRemoved = 0;
    const diffElements = diff.map((part, idx) => {
      const { value, added, removed } = part;
      let nodeStyles;
      if (added) {
        nodeStyles = "text-xs bg-green-200 text-green-800 px-[3px] py-px rounded-md";
        cntAdded++;
      } else if (removed) {
        nodeStyles = "text-xs bg-red-200 text-red-800 px-[3px] py-px rounded-md";
        cntRemoved++;
      } else {
        nodeStyles = "text-xs text-gray-800";
      }
      return (
        <span className={nodeStyles} key={idx}>
          {value}
        </span>
      );
    });

    if (cntAdded === 0 && cntRemoved === 0) {
      // Sometimes there is no diff.
      // This can happen when the text is the same but the user requires a response.
      // In this case, we don't want to show the diff button.
      return;
    }
    setMappedNodes(diffElements);
  }, [preRef, attachment]);

  return (
    <div className="my-2 w-full flex flex-col gap-2">
      <pre className="w-full p-2 rounded-md bg-gray-200 text-sm whitespace-pre-wrap" id="text-patches-diff-display">
        {showDiff ? mappedNodes : processedChildren}
      </pre>
      <pre
        ref={preRef}
        className="w-full p-2 rounded-md bg-gray-200 text-sm whitespace-pre-wrap hidden"
        id="text-patches-pre-raw"
      >
        {processedChildren}
      </pre>
      <div className="flex flex-row gap-2 justify-end">
        {mappedNodes.length > 0 && (
          <Button
            className="text-default-600"
            size="sm"
            variant={showDiff ? "solid" : "light"}
            radius="full"
            onPress={() => {
              googleAnalytics.fireEvent(user?.id, "textpatch_click_diff_button", {
                projectId: getProjectId(),
                patchLength: preRef.current?.innerText.length ?? 0,
              });
              setShowDiff(!showDiff);
            }}
          >
            Diff
          </Button>
        )}

        <Button
          className="text-default-600"
          size="sm"
          variant="light"
          radius="full"
          onPress={() => {
            googleAnalytics.fireEvent(user?.id, "textpatch_click_copy_button", {
              projectId: getProjectId(),
              patchLength: preRef.current?.innerText.length ?? 0,
            });
            copyText();
          }}
        >
          {copyBtnText}
        </Button>
        <Button
          size="sm"
          variant="bordered"
          color={selectionRange ? "primary" : "default"}
          radius="full"
          disabled={!selectionRange}
          style={{
            opacity: selectionRange ? 1 : 0.5,
          }}
          onPress={() => {
            googleAnalytics.fireEvent(user?.id, "textpatch_click_insert_button", {
              projectId: getProjectId(),
              patchLength: preRef.current?.innerText.length ?? 0,
            });
            applyText();
          }}
        >
          {insertBtnText}
        </Button>
      </div>
    </div>
  );
}
