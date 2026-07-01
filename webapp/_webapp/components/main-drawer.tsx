import { Rnd } from "react-rnd";
import { Component, useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { usePaperDebuggerUiStore, type DisplayMode, type TabOrientation } from "@/stores/paper-debugger-ui-store";
import { ChatPanel } from "@/components/chat-panel";
import { chatStream, type ChatProvider } from "@/lib/chat-stream";
import { useChatStatsStore } from "@/stores/chat-stats-store";
import IconX from "~icons/lucide/x";
import IconSquare from "~icons/lucide/square";
import IconPanelRight from "~icons/lucide/panel-right";
import IconPanelBottom from "~icons/lucide/panel-bottom";
import IconMessageSquare from "~icons/lucide/message-square";
import IconSettings from "~icons/lucide/settings";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// A crashing panel (e.g. assistant-ui mount error) shouldn't blank the whole
// drawer — catch it and show the message instead.
class PanelErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontSize: 12, color: "#dc2626", whiteSpace: "pre-wrap" }}>
          Panel crashed: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

const MODE_ICON: Record<DisplayMode, IconComponent> = {
  floating: IconSquare,
  "right-fixed": IconPanelRight,
  "bottom-fixed": IconPanelBottom,
};

function TitleBar({ children }: { children?: ReactNode }) {
  const { displayMode, update } = usePaperDebuggerUiStore();
  return (
    <div className="pd-app-title-bar pd-drag-handle select-none">
      <button className="pd-ctl-btn" title="Close" onClick={() => update({ isOpen: false })}>
        <IconX width={16} height={16} />
      </button>
      {(Object.keys(MODE_ICON) as DisplayMode[]).map((mode) => {
        const ModeIcon = MODE_ICON[mode];
        return (
          <button
            key={mode}
            className="pd-ctl-btn"
            title={mode}
            style={{ opacity: displayMode === mode ? 1 : 0.5 }}
            onClick={() => update({ displayMode: mode })}
          >
            <ModeIcon width={16} height={16} />
          </button>
        );
      })}
      {children}
    </div>
  );
}

type Tab = { id: string; label: string; icon: IconComponent; content: ReactNode };

type ConnStatus = { state: "idle" | "checking" | "ok" | "fail"; message?: string };

function SettingsPanel() {
  const { tabOrientation, provider, update } = usePaperDebuggerUiStore();
  const [conn, setConn] = useState<ConnStatus>({ state: "idle" });

  const testConnection = () => {
    setConn({ state: "checking" });
    chatStream({ type: "ping" }, () => {}).then(
      () => setConn({ state: "ok" }),
      (err) => setConn({ state: "fail", message: err instanceof Error ? err.message : String(err) }),
    );
  };

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 20 }}>
      <section>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Provider</div>
        <div className="pd-seg" role="radiogroup" aria-label="Provider">
          {(["claude", "codex"] as ChatProvider[]).map((p) => (
            <button key={p} role="radio" aria-checked={provider === p} onClick={() => update({ provider: p })}>
              {p}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Local host</div>
        <button className="pd-action" onClick={testConnection} disabled={conn.state === "checking"}>
          {conn.state === "checking" ? "Checking…" : "Test connection"}
        </button>
        {conn.state === "ok" && <div style={{ marginTop: 8, color: "#16a34a" }}>✓ Connected to pd-host.</div>}
        {conn.state === "fail" && (
          <div style={{ marginTop: 8, color: "#dc2626", whiteSpace: "pre-wrap" }}>✗ {conn.message}</div>
        )}
      </section>

      <section>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Tab layout</div>
        <div className="pd-seg" role="radiogroup" aria-label="Tab layout">
          {(["vertical", "horizontal"] as const).map((o) => (
            <button
              key={o}
              role="radio"
              aria-checked={tabOrientation === o}
              onClick={() => update({ tabOrientation: o })}
            >
              {o}
            </button>
          ))}
        </div>
      </section>

      <StatsSection />
    </div>
  );
}

// Per-turn timing, newest first, so you can see what drove TTFT each turn.
// Phases come from the host: codex = startup/thread/mcp/reasoning/streaming,
// claude = streaming only (SDK exposes no internals; ttft covers the rest).
function StatsSection() {
  const { turns, clear } = useChatStatsStore();
  const s = (ms?: number) => (ms == null ? "–" : `${(ms / 1000).toFixed(1)}s`);
  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>Timing (last {turns.length})</span>
        {turns.length > 0 && (
          <button className="pd-action" style={{ padding: "2px 8px", fontSize: 12 }} onClick={clear}>
            Clear
          </button>
        )}
      </div>
      {turns.length === 0 ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>Ask something — per-turn breakdowns show up here.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, fontFamily: "monospace" }}>
          {turns.map((t, i) => (
            <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 8px" }}>
              <div style={{ marginBottom: 4 }}>
                <b>{t.provider}</b>
                {t.model ? ` ${t.model}` : ""} · TTFT {s(t.ttftMs)} · total {s(t.totalMs)}
                {t.ok ? "" : " · ✗"}
              </div>
              <div style={{ color: "#4b5563" }}>{t.phases.map((p) => `${p.name} ${s(p.ms)}`).join("  ·  ")}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const TABS: Tab[] = [
  { id: "chat", label: "Chat", icon: IconMessageSquare, content: <ChatPanel /> },
  { id: "settings", label: "Settings", icon: IconSettings, content: <SettingsPanel /> },
];

function TabList({
  orientation,
  active,
  setActive,
}: {
  orientation: TabOrientation;
  active: string;
  setActive: (id: string) => void;
}) {
  return (
    // pd-drag-handle: the rail's empty area drags the window; the .pd-tab
    // buttons stay clickable via Rnd's `cancel` selector.
    <div className="pd-tablist pd-drag-handle select-none" role="tablist" aria-orientation={orientation}>
      {TABS.map((t) => {
        const TabIcon = t.icon;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === active}
            className="pd-tab"
            title={t.label}
            onClick={() => setActive(t.id)}
          >
            <TabIcon width={16} height={16} />
            {orientation === "horizontal" && <span>{t.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Horizontal: the tablist folds into the title bar, panel fills the rest.
// Vertical: a side rail of tabs sits next to the panel.
function DrawerShell({ orientation }: { orientation: TabOrientation }) {
  const [active, setActive] = useState(TABS[0].id);
  const tablist = <TabList orientation={orientation} active={active} setActive={setActive} />;
  // Render every panel and hide the inactive ones (rather than unmounting), so
  // per-tab state — chat history, scroll — survives tab switches.
  const panels = TABS.map((t) => (
    <div
      key={t.id}
      className="pd-tabpanel pd-drag-handle"
      role="tabpanel"
      style={{ display: t.id === active ? undefined : "none" }}
    >
      <PanelErrorBoundary>{t.content}</PanelErrorBoundary>
    </div>
  ));

  // Same tree shape for both orientations so panels (and their chat state) never
  // remount on a switch — only the tablist moves (into the title bar for
  // horizontal, into the rail for vertical) and the flex axis flips via CSS.
  return (
    <>
      <TitleBar>{orientation === "horizontal" ? tablist : null}</TitleBar>
      <div className={`pd-tabs pd-tabs-${orientation}`}>
        {orientation === "vertical" ? tablist : null}
        {panels}
      </div>
    </>
  );
}

function Container({ children }: { children: ReactNode }) {
  return (
    <div className="pd-app-container" id="pd-container">
      {children}
    </div>
  );
}

type RndProps = React.ComponentProps<typeof Rnd>;
type Win = { width: number; height: number };

// Per-mode geometry for react-rnd: floating is free-drag/resize; the fixed modes
// dock to an edge and only resize along that edge.
function getRndProps(s: ReturnType<typeof usePaperDebuggerUiStore.getState>, win: Win): Partial<RndProps> {
  switch (s.displayMode) {
    case "floating":
      return {
        position: { x: s.floatingX, y: s.floatingY },
        size: { width: s.floatingWidth, height: s.floatingHeight },
        minWidth: 400,
        minHeight: 320,
        enableResizing: true,
        disableDragging: false,
      };
    case "right-fixed":
      return {
        default: { x: win.width - s.rightFixedWidth, y: 0, width: s.rightFixedWidth, height: win.height },
        position: { x: win.width - s.rightFixedWidth, y: 0 },
        size: { width: s.rightFixedWidth, height: win.height },
        minWidth: 400,
        minHeight: 320,
        enableResizing: { left: true, right: false, top: false, bottom: false },
        disableDragging: true,
      };
    case "bottom-fixed":
      return {
        default: { x: 0, y: win.height - s.bottomFixedHeight, width: win.width, height: s.bottomFixedHeight },
        position: { x: 0, y: win.height - s.bottomFixedHeight },
        size: { width: win.width, height: s.bottomFixedHeight },
        minWidth: win.width,
        minHeight: 320,
        enableResizing: { left: false, right: false, top: true, bottom: false },
        disableDragging: true,
      };
  }
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

  const rndProps = getRndProps(s, win);

  // No portal: <App/> is already mounted in #paper-debugger-root, so rendering
  // here keeps the drawer inside that scope (where the prefixed pd.css applies).
  // Rnd is absolutely positioned → coords resolve against the viewport regardless.
  return (
    <Rnd
      id="paper-debugger-rnd"
      dragHandleClassName="pd-drag-handle"
      cancel=".pd-ctl-btn, .pd-tab, .pd-seg, .pd-action, .pd-composer, .pd-msg"
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
          s.update({
            floatingX: position.x,
            floatingY: position.y,
            floatingWidth: ref.offsetWidth,
            floatingHeight: ref.offsetHeight,
          });
        } else if (s.displayMode === "right-fixed") {
          s.update({ rightFixedWidth: ref.offsetWidth });
        } else {
          s.update({ bottomFixedHeight: ref.offsetHeight });
        }
      }}
      onDragStart={() => s.displayMode === "floating" && setDragging(true)}
      onDragStop={(_e, d) => {
        if (s.displayMode === "floating") {
          s.update({ floatingX: d.x, floatingY: d.y });
          setDragging(false);
        }
      }}
    >
      <Container>
        <DrawerShell orientation={s.tabOrientation} />
      </Container>
    </Rnd>
  );
};
