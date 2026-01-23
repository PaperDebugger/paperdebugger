import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useConversationUiStore } from "../stores/conversation/conversation-ui-store";
import { PdAppContainer } from "../components/pd-app-container";
import { WindowController } from "./window-controller";
import { Body } from "./body";

export const EmbedSidebar = () => {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const { embedWidth, isOpen, setEmbedWidth } = useConversationUiStore();
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const embedWidthRef = useRef(embedWidth);
  const isResizingRef = useRef(false);
  const originalBodyStyleRef = useRef<{
    display?: string;
    flexDirection?: string;
  }>({});

  // Keep ref in sync with embedWidth
  useEffect(() => {
    embedWidthRef.current = embedWidth;
  }, [embedWidth]);

  // Function to update main content area flex properties
  const updateMainContentFlex = useCallback((ideBody: HTMLElement) => {
    // Find or create ide-redesign-inner
    let ideInner = ideBody.querySelector(".ide-redesign-inner") as HTMLElement | null;
    if (!ideInner) {
      ideInner = document.createElement("div");
      ideInner.className = "ide-redesign-inner";
      // Move all existing children (except sidebar) into ideInner
      const children = Array.from(ideBody.children) as HTMLElement[];
      children.forEach((child) => {
        if (child.id !== "pd-embed-sidebar" && !child.classList.contains("ide-redesign-inner")) {
          ideInner!.appendChild(child);
        }
      });
      // Insert ideInner before sidebar (or at the beginning if no sidebar)
      const sidebar = ideBody.querySelector("#pd-embed-sidebar");
      if (sidebar) {
        ideBody.insertBefore(ideInner, sidebar);
      } else {
        ideBody.appendChild(ideInner);
      }
    }
    
    // Set flex properties for ide-redesign-inner
    ideInner.style.flex = "1";
    ideInner.style.minWidth = "0";
    ideInner.style.overflow = "hidden";
  }, []);

  // Update container width when embedWidth changes
  useEffect(() => {
    if (container) {
      container.style.width = `${embedWidth}px`;
    }
    
    // Also update layout when embedWidth changes
    if (isOpen) {
      const ideBody = document.querySelector(".ide-redesign-body") as HTMLElement | null;
      if (ideBody) {
        // Re-apply flex layout
        updateMainContentFlex(ideBody);
      }
    }
  }, [container, embedWidth, isOpen, updateMainContentFlex]);

  // Handle window resize to ensure layout stays correct
  useEffect(() => {
    if (!isOpen || !container) return;

    const handleResize = () => {
      const ideBody = document.querySelector(".ide-redesign-body") as HTMLElement | null;
      if (ideBody) {
        // Re-apply flex layout on window resize
        updateMainContentFlex(ideBody);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, container, updateMainContentFlex]);

  useEffect(() => {
    if (!isOpen) return;

    // Find ide-redesign-body (works in both normal and dev mode)
    const ideBody = document.querySelector(".ide-redesign-body") as HTMLElement | null;

    if (!ideBody) {
      return;
    }

    // Store original styles
    originalBodyStyleRef.current = {
      display: ideBody.style.display || "",
      flexDirection: ideBody.style.flexDirection || "",
    };

    // Ensure ide-redesign-inner exists and has correct flex properties
    updateMainContentFlex(ideBody);

    // Create sidebar container
    const sidebarDiv = document.createElement("div");
    sidebarDiv.id = "pd-embed-sidebar";
    sidebarDiv.className = "pd-embed-sidebar";
    sidebarDiv.style.width = `${embedWidth}px`;
    sidebarDiv.style.height = "100%"; // Use 100% to match parent height
    sidebarDiv.style.display = "flex";
    sidebarDiv.style.flexDirection = "column";
    sidebarDiv.style.borderLeft = "1px solid var(--pd-border-color)";
    sidebarDiv.style.flexShrink = "0";
    sidebarDiv.style.position = "relative";
    sidebarDiv.style.overflow = "hidden"; // Prevent overflow

    // Modify parent container to flex layout
    ideBody.style.display = "flex";
    ideBody.style.flexDirection = "row";
    ideBody.style.width = "100%";
    ideBody.style.height = "100vh"; // Ensure full viewport height
    ideBody.style.overflow = "hidden";

    // Append sidebar to ideBody (after ide-redesign-inner)
    ideBody.appendChild(sidebarDiv);
    setContainer(sidebarDiv);

    return () => {
      // Cleanup
      const sidebarDiv = document.getElementById("pd-embed-sidebar");
      if (sidebarDiv) {
        sidebarDiv.remove();
      }

      // Restore original styles
      if (ideBody && originalBodyStyleRef.current) {
        ideBody.style.display = originalBodyStyleRef.current.display || "";
        ideBody.style.flexDirection = originalBodyStyleRef.current.flexDirection || "";
        ideBody.style.width = "";
        ideBody.style.height = "";
        ideBody.style.overflow = "";
        
        // Restore ide-redesign-inner flex properties
        const ideInner = ideBody.querySelector(".ide-redesign-inner") as HTMLElement | null;
        if (ideInner) {
          ideInner.style.flex = "";
          ideInner.style.minWidth = "";
          ideInner.style.overflow = "";
        }
      }

      setContainer(null);
    };
  }, [isOpen, embedWidth, updateMainContentFlex]);

  // Handle resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = embedWidthRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      e.preventDefault();
      const delta = e.clientX - startX;
      const maxWidth = window.innerWidth * 0.8; // 80% of window width
      const newWidth = Math.max(300, Math.min(maxWidth, startWidth - delta)); // min 300px, max 80% of window
      setEmbedWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [setEmbedWidth]);

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
        onMouseDown={handleMouseDown}
      >
        {/* Visual indicator line */}
        <div className="resize-handle-indicator" />
      </div>
      <PdAppContainer>
        <WindowController />
        <Body />
      </PdAppContainer>
    </div>,
    container,
  );
};
