import { Rnd } from "react-rnd";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePaperDebuggerUiStore, type DisplayMode, type TabOrientation } from "@/stores/paper-debugger-ui-store";

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

// ponytail: tab content is stubbed — the chat / settings panels are the rewrite
// you're doing separately. This wires up switching + layout only.
type Tab = { id: string; label: string; icon: ReactNode; content: ReactNode };

const TAB_ICON = {
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
};

const Stub = ({ children }: { children: ReactNode }) => (
  <div style={{ padding: 16, fontSize: 13, color: "var(--color-pd-muted)" }}>{children}</div>
);

function SettingsPanel() {
  const { tabOrientation, setTabOrientation } = usePaperDebuggerUiStore();
  return (
    <div style={{ padding: 16, fontSize: 13 }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Tab layout</div>
      <div className="pd-seg" role="radiogroup" aria-label="Tab layout">
        {(["vertical", "horizontal"] as const).map((o) => (
          <button key={o} role="radio" aria-checked={tabOrientation === o} onClick={() => setTabOrientation(o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

const TABS: Tab[] = [
  { id: "chat", label: "Chat", icon: TAB_ICON.chat, content: <Stub>Chat panel — pending rewrite.</Stub> },
  { id: "settings", label: "Settings", icon: TAB_ICON.settings, content: <SettingsPanel /> },
];

function Tabs({ orientation }: { orientation: TabOrientation }) {
  const [active, setActive] = useState(TABS[0].id);
  const current = TABS.find((t) => t.id === active) ?? TABS[0];
  return (
    <div className={`pd-tabs pd-tabs-${orientation}`}>
      <div className="pd-tablist" role="tablist" aria-orientation={orientation}>
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === active}
            className="pd-tab"
            title={t.label}
            onClick={() => setActive(t.id)}
          >
            <Icon>{t.icon}</Icon>
            {orientation === "horizontal" && <span>{t.label}</span>}
          </button>
        ))}
      </div>
      <div className="pd-tabpanel" role="tabpanel">
        {current.content}
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
        <Tabs orientation={s.tabOrientation} />
      </Container>
    </Rnd>,
    document.body,
  );
};
