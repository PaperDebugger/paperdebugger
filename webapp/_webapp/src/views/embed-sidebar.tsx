import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useConversationUiStore } from "../stores/conversation/conversation-ui-store";
import { PdAppContainer } from "../components/pd-app-container";
import { WindowController } from "./window-controller";
import { Body } from "./body";
import { onElementAppeared } from "../libs/helpers";

export const EmbedSidebar = () => {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const { embedWidth, isOpen, setEmbedWidth } = useConversationUiStore();
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const embedWidthRef = useRef(embedWidth);
  const originalBodyStyleRef = useRef<{
    display?: string;
    flexDirection?: string;
  }>({});

  // Keep ref in sync with embedWidth
  useEffect(() => {
    embedWidthRef.current = embedWidth;
  }, [embedWidth]);

  // Update container width when embedWidth changes
  useEffect(() => {
    if (container) {
      container.style.width = `${embedWidth}px`;
    }
  }, [container, embedWidth]);

  useEffect(() => {
    if (!isOpen) return;

    // Try to find Overleaf's body element first (extension mode)
    const ideBody = document.querySelector(".ide-redesign-body") as HTMLElement | null;

    // If not found, use the main body for dev:chat mode
    const targetElement = ideBody || document.body;

    if (!targetElement) return;

    // Store original styles
    originalBodyStyleRef.current = {
      display: targetElement.style.display || "",
      flexDirection: targetElement.style.flexDirection || "",
    };

    // Create sidebar container
    const sidebarDiv = document.createElement("div");
    sidebarDiv.id = "pd-embed-sidebar";
    sidebarDiv.style.width = `${embedWidth}px`;
    sidebarDiv.style.height = "100vh";
    sidebarDiv.style.display = "flex";
    sidebarDiv.style.flexDirection = "column";
    sidebarDiv.style.borderLeft = "1px solid var(--pd-border-color)";
    sidebarDiv.style.flexShrink = "0";
    sidebarDiv.style.position = ideBody ? "relative" : "fixed";
    sidebarDiv.style.right = "0";
    sidebarDiv.style.top = "0";

    // Modify parent container to flex layout (only in extension mode)
    if (ideBody) {
      targetElement.style.display = "flex";
      targetElement.style.flexDirection = "row";

      // Find the main content area and ensure it can grow
      const mainContent = targetElement.querySelector(".ide-redesign-toolbar-menu-bar, .editor-area");
      if (mainContent) {
        (mainContent as HTMLElement).style.flex = "1";
        (mainContent as HTMLElement).style.minWidth = "0";
      }
    } else {
      // In dev:chat mode, adjust body to make room for sidebar
      const rootPaperDebugger = document.getElementById("root-paper-debugger");
      if (rootPaperDebugger) {
        (rootPaperDebugger as HTMLElement).style.marginRight = `${embedWidth}px`;
        (rootPaperDebugger as HTMLElement).style.transition = "margin-right 0.2s";
      }
    }

    // Append sidebar to target element
    targetElement.appendChild(sidebarDiv);
    setContainer(sidebarDiv);

    return () => {
      // Cleanup
      const sidebarDiv = document.getElementById("pd-embed-sidebar");
      if (sidebarDiv) {
        sidebarDiv.remove();
      }

      // Restore original styles for extension mode
      const ideBody = document.querySelector(".ide-redesign-body") as HTMLElement | null;
      if (ideBody && originalBodyStyleRef.current) {
        ideBody.style.display = originalBodyStyleRef.current.display || "";
        ideBody.style.flexDirection = originalBodyStyleRef.current.flexDirection || "";
      }

      // Restore margin for dev:chat mode
      const rootPaperDebugger = document.getElementById("root-paper-debugger");
      if (rootPaperDebugger) {
        (rootPaperDebugger as HTMLElement).style.marginRight = "";
      }

      setContainer(null);
    };
  }, [isOpen]);

  // Handle resize - only set up when container exists
  useEffect(() => {
    if (!container || !isOpen) return;
    
    const handleRef = resizeHandleRef.current;
    if (!handleRef) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = embedWidthRef.current;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      startX = e.clientX;
      startWidth = embedWidthRef.current;
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      e.preventDefault();
      const delta = e.clientX - startX;
      const newWidth = Math.max(300, Math.min(800, startWidth - delta)); // min 300px, max 800px
      setEmbedWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "";
    };

    handleRef.addEventListener("mousedown", handleMouseDown);

    return () => {
      handleRef.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "";
    };
  }, [container, isOpen, setEmbedWidth]);

  if (!container || !isOpen) return null;

  return createPortal(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Resize handle on the left */}
      <div
        ref={resizeHandleRef}
        className="pd-embed-resize-handle"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "8px",
          cursor: "col-resize",
          backgroundColor: "transparent",
          transition: "background-color 0.2s",
          zIndex: 10000,
          pointerEvents: "auto",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "var(--pd-primary-color, #3b82f6)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
        }}
      />
      <PdAppContainer>
        <WindowController />
        <Body />
      </PdAppContainer>
    </div>,
    container,
  );
};
