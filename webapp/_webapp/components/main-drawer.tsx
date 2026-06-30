import { Rnd } from "react-rnd";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePaperDebuggerUiStore, type DisplayMode } from "@/stores/paper-debugger-ui-store";

// ponytail: @iconify dropped — inline lucide-style SVGs, no icon dep.
const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const MODE_ICON: Record<DisplayMode, ReactNode> = {
  floating: <rect x="4" y="6" width="16" height="13" rx="2" />,
  "right-fixed": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </>
  ),
  "bottom-fixed": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 14h18" />
    </>
  ),
};

function TitleBar() {
  const { displayMode, setDisplayMode, setIsOpen } = usePaperDebuggerUiStore();
  return (
    <div className="pd-app-title-bar pd-drag-handle select-none">
      <button className="pd-ctl-btn" title="Close" onClick={() => setIsOpen(false)}>
        <Icon>
          <path d="M18 6 6 18M6 6l12 12" />
        </Icon>
      </button>
      {(Object.keys(MODE_ICON) as DisplayMode[]).map((mode) => (
        <button
          key={mode}
          className="pd-ctl-btn"
          title={mode}
          style={{ opacity: displayMode === mode ? 1 : 0.5 }}
          onClick={() => setDisplayMode(mode)}
        >
          <Icon>{MODE_ICON[mode]}</Icon>
        </button>
      ))}
    </div>
  );
}

// ponytail: stub panel — outer body frame only. Inner content (chat / settings)
// is the rewrite you're doing separately.
function Body() {
  return (
    <div className="pd-app-body">
      <div style={{ padding: 16, fontSize: 13, color: "#6b7280" }}>
        PaperDebugger panel — inner content (chat / settings) pending rewrite.
      </div>
    </div>
  );
}

function Container({ children }: { children: ReactNode }) {
  return (
    <div className="pd-app-container" id="pd-container">
      {children}
    </div>
  );
}

export const MainDrawer = () => {
  const s = usePaperDebuggerUiStore();
  const [dragging, setDragging] = useState(false);
  const [win, setWin] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const onResize = () => setWin({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  type RndProps = React.ComponentProps<typeof Rnd>;
  let rndProps: Partial<RndProps> = {};
  if (s.displayMode === "floating") {
    rndProps = {
      position: { x: s.floatingX, y: s.floatingY },
      size: { width: s.floatingWidth, height: s.floatingHeight },
      minWidth: 400,
      minHeight: 320,
      enableResizing: true,
      disableDragging: false,
    };
  } else if (s.displayMode === "right-fixed") {
    rndProps = {
      default: { x: win.width - s.rightFixedWidth, y: 0, width: s.rightFixedWidth, height: win.height },
      position: { x: win.width - s.rightFixedWidth, y: 0 },
      size: { width: s.rightFixedWidth, height: win.height },
      minWidth: 400,
      minHeight: 320,
      enableResizing: { left: true, right: false, top: false, bottom: false },
      disableDragging: true,
    };
  } else if (s.displayMode === "bottom-fixed") {
    rndProps = {
      default: { x: 0, y: win.height - s.bottomFixedHeight, width: win.width, height: s.bottomFixedHeight },
      position: { x: 0, y: win.height - s.bottomFixedHeight },
      size: { width: win.width, height: s.bottomFixedHeight },
      minWidth: win.width,
      minHeight: 320,
      enableResizing: { left: false, right: false, top: true, bottom: false },
      disableDragging: true,
    };
  }

  return createPortal(
    <Rnd
      id="paper-debugger-rnd"
      dragHandleClassName="pd-drag-handle"
      cancel=".pd-ctl-btn"
      className={`pd-rnd${dragging ? " dragging" : ""}`}
      {...rndProps}
      style={{
        opacity: s.isOpen ? 1 : 0,
        pointerEvents: s.isOpen ? "auto" : "none",
        cursor: "default",
        zIndex: 998,
        borderRadius: "0.75rem",
      }}
      bounds="window"
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        if (s.displayMode === "floating") {
          s.setFloatingX(position.x);
          s.setFloatingY(position.y);
          s.setFloatingWidth(ref.offsetWidth);
          s.setFloatingHeight(ref.offsetHeight);
        } else if (s.displayMode === "right-fixed") {
          s.setRightFixedWidth(ref.offsetWidth);
        } else {
          s.setBottomFixedHeight(ref.offsetHeight);
        }
      }}
      onDragStart={() => s.displayMode === "floating" && setDragging(true)}
      onDragStop={(_e, d) => {
        if (s.displayMode === "floating") {
          s.setFloatingX(d.x);
          s.setFloatingY(d.y);
          setDragging(false);
        }
      }}
    >
      <Container>
        <TitleBar />
        <Body />
      </Container>
    </Rnd>,
    document.body,
  );
};
