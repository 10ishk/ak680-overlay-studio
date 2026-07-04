import React, { Component, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion } from "framer-motion";
import {
  Activity,
  Brush,
  CheckCircle2,
  Gauge,
  Keyboard,
  ListTodo,
  Loader2,
  MonitorUp,
  Settings,
  Shield,
  SlidersHorizontal,
  TerminalSquare,
  XCircle,
  Zap
} from "lucide-react";
import { getBridge } from "../bridge/ak680Bridge";
import {
  appendEvent,
  appendMarker,
  deriveLogState,
  exportLogJson,
  initialLogState,
  normalizeGuestEvent,
  OverlayAction,
  OverlayActionStatus,
  OverlayLogEvent,
  setWebviewMode,
  startCaptureSession,
  stopCaptureSession,
  timestampFilename,
  upsertOverlayAction,
  WebviewMode
} from "./logStore";
import {
  commandResultFromPayload,
  createCommand,
  officialPaths,
  pathFromUrl,
  toOfficialUrl,
  OfficialPath,
  WebviewCommand,
  WebviewCommandResult,
  WebviewCommandType
} from "./officialDriverController";
import "./styles.css";

type Page = "Dashboard" | "Lighting" | "Performance" | "Advanced Keys" | "SOCD" | "Keymap" | "Macros" | "Official Driver" | "Logs" | "Settings";
type Filter = "All" | "HID" | "DOM" | "Markers" | "Errors" | "Actions";

type ElectronWebview = HTMLElement & {
  getURL?: () => string;
  loadURL?: (url: string) => Promise<void>;
  reload?: () => void;
  send?: (channel: string, ...args: unknown[]) => void;
};

type OfficialLoadState = "loading" | "loaded" | "failed" | "blank";

type PendingCommand = {
  page: Page;
  action: string;
  targetOfficialPath: OfficialPath;
  startedAt: string;
  resolve: (result: WebviewCommandResult) => void;
  timeout: number;
};

type OverlayApi = {
  openOfficialPath(path?: OfficialPath, switchPage?: boolean): void;
  runOverlayAction(options: RunActionOptions): Promise<WebviewCommandResult>;
};

type RunActionOptions = {
  page: Page;
  action: string;
  targetOfficialPath: OfficialPath;
  commandType: WebviewCommandType;
  text?: string;
  selector?: string;
  value?: string | number | boolean;
  tag?: string;
  nearText?: string;
};

const bridge = getBridge();
const pages: Array<{ name: Page; icon: React.ElementType }> = [
  { name: "Dashboard", icon: Activity },
  { name: "Lighting", icon: Brush },
  { name: "Performance", icon: Gauge },
  { name: "Advanced Keys", icon: SlidersHorizontal },
  { name: "SOCD", icon: Shield },
  { name: "Keymap", icon: Keyboard },
  { name: "Macros", icon: ListTodo },
  { name: "Official Driver", icon: MonitorUp },
  { name: "Logs", icon: TerminalSquare },
  { name: "Settings", icon: Settings }
];

const themes = ["Carbon Orange", "Obsidian", "Neon Blue", "Violet", "Frost", "Matcha", "Terminal"];
const markerExamples = ["SOCD baseline", "SOCD ON", "SOCD OFF", "RT 1.2mm", "Lighting Snowfall", "Macro Save", "Before change", "After change"];
const lightingEffects = ["Static Bright", "Single Point On", "Single Point Off", "Starry Sky", "Snowfall", "Floral Competition", "Dynamic Breath", "Spectrum Cycle", "Color Fountain", "Ripples Spread", "Endless Flow", "Back and Forth", "Custom"];
const colors = ["#ff7a1a", "#39a7ff", "#a78bfa", "#9bd67b", "#ffffff", "#ff4d6d"];
const keyAssignments = ["Esc", "Tab", "Caps Lock", "Left Shift", "Left Ctrl", "Left Alt", "Space", "Backspace", "Enter", "Delete", "Home", "End", "Page Up", "Page Down"];
const macroSlots = ["Game Push", "Layer Tap", "Media Stack", "Rapid Utility"];
const macroTargets = ["F1", "F2", "F3", "F4", "Ins", "Del", "Home", "End"];
const advancedModules = ["RS / Snappy", "DKS", "MT", "TGL"];
const socdModes = ["Neutral", "Last Input Priority", "Absolute Priority", "Off"];
const returnRates = ["125Hz", "250Hz", "500Hz", "1000Hz"];
const ak680Rows = [
  ["Esc", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "Backspace", "Home"],
  ["Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\", "Delete"],
  ["Caps", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "Enter", "PgUp"],
  ["Shift", "Z", "X", "C", "V", "B", "N", "M", "<", ">", "?", "Shift", "Up", "PgDn"],
  ["Ctrl", "Win", "Alt", "Space", "Alt", "Fn", "Ctrl", "Left", "Down", "Right"]
];

console.log("AK680 renderer booted");

type ErrorBoundaryState = {
  error?: Error;
};

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error("AK680 renderer failed", error);
  }

  render() {
    if (this.state.error) {
      return <RendererFailure error={this.state.error} />;
    }
    return this.props.children;
  }
}

function RendererFailure({ error }: { error: Error }) {
  return (
    <div className="rendererFailure">
      <section className="panel">
        <span>AK680 Overlay Studio {bridge.metadata.version}</span>
        <strong>Renderer failed to load</strong>
        <p>{error.message}</p>
        <p>Open DevTools from the Electron View menu for the full console trace.</p>
      </section>
    </div>
  );
}

function App() {
  const [page, setPage] = useState<Page>("Dashboard");
  const [theme, setTheme] = useState(readInitialTheme);
  const [logState, setLogState] = useState(initialLogState);
  const [marker, setMarker] = useState(markerExamples[0]);
  const [officialTargetUrl, setOfficialTargetUrl] = useState(bridge.metadata.officialDriverUrl);
  const [toast, setToast] = useState<string | undefined>();
  const webviewRef = useRef<ElectronWebview | null>(null);
  const pendingCommands = useRef(new Map<string, PendingCommand>());
  const officialUrlRef = useRef(initialLogState.officialUrl);
  const derived = useMemo(() => deriveLogState(logState), [logState]);

  useEffect(() => {
    officialUrlRef.current = logState.officialUrl;
  }, [logState.officialUrl]);

  const setThemePersisted = useCallback((nextTheme: string) => {
    setTheme(nextTheme);
    try {
      localStorage.setItem("ak680-theme", nextTheme);
    } catch {
      // Theme persistence should not block the overlay UI.
    }
  }, []);

  const addLogEvent = useCallback((payload: unknown) => {
    const result = commandResultFromPayload(payload);
    if (result) {
      const pending = pendingCommands.current.get(result.id);
      if (pending) {
        window.clearTimeout(pending.timeout);
        pendingCommands.current.delete(result.id);
        setLogState((state) => upsertOverlayAction(state, {
          id: result.id,
          timestamp: result.timestamp,
          page: pending.page,
          action: pending.action,
          targetOfficialPath: pending.targetOfficialPath,
          status: result.success ? "success" : "failure",
          message: result.message,
          matchedText: result.matchedText,
          selector: result.selector,
          details: result.details
        }));
        setToast(result.success ? `Applied: ${pending.action}` : result.message);
        pending.resolve(result);
      }
    }
    setLogState((state) => appendEvent(state, normalizeGuestEvent(payload, state.officialUrl)));
  }, []);

  useEffect(() => {
    return bridge.host?.onPermissionEvent((payload) => {
      addLogEvent({ source: "host", type: "permission", phase: "event", summary: "Host WebHID permission event", ...asRecord(payload) });
    });
  }, [addLogEvent]);

  const updateOfficialUrl = useCallback((url: string, type = "navigation") => {
    setLogState((state) => appendEvent(state, normalizeGuestEvent({ source: "host", type, phase: "event", url, summary: `Official webview ${type}` }, state.officialUrl)));
  }, []);

  const openOfficialPath = useCallback((path?: OfficialPath, switchToOfficial = false) => {
    const targetPath = path ?? pathFromUrl(officialUrlRef.current);
    const url = toOfficialUrl(targetPath);
    setOfficialTargetUrl((current) => current === url ? current : url);
    if (switchToOfficial) setPage("Official Driver");
    setLogState((state) => {
      const nextState = switchToOfficial ? setWebviewMode(state, "Docked") : state;
      return appendEvent(nextState, normalizeGuestEvent({ source: "host", type: "route-open", phase: "event", url, summary: `Open official route ${targetPath}` }, state.officialUrl));
    });
  }, []);

  const sendCommand = useCallback((command: WebviewCommand): void => {
    try {
      webviewRef.current?.send?.("ak680-command", command);
    } catch (error) {
      console.error("Failed to send official webview command", error);
    }
  }, []);

  const runOverlayAction = useCallback((options: RunActionOptions): Promise<WebviewCommandResult> => {
    openOfficialPath(options.targetOfficialPath, false);
    const command = createCommand(options.commandType, {
      path: options.targetOfficialPath,
      text: options.text,
      selector: options.selector,
      value: options.value,
      tag: options.tag,
      nearText: options.nearText
    });
    const startedAt = new Date().toISOString();
    setLogState((state) => upsertOverlayAction(state, {
      id: command.id,
      timestamp: startedAt,
      page: options.page,
      action: options.action,
      targetOfficialPath: options.targetOfficialPath,
      status: "pending",
      message: "Sent to official webview"
    }));
    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        pendingCommands.current.delete(command.id);
        const result: WebviewCommandResult = {
          id: command.id,
          ok: false,
          command: command.type,
          commandId: command.id,
          timestamp: new Date().toISOString(),
          type: command.type,
          success: false,
          message: "Official webview did not respond before timeout",
          route: options.targetOfficialPath
        };
        setLogState((state) => upsertOverlayAction(state, {
          id: command.id,
          timestamp: result.timestamp,
          page: options.page,
          action: options.action,
          targetOfficialPath: options.targetOfficialPath,
          status: "failure",
          message: result.message
        }));
        setToast(result.message);
        resolve(result);
      }, command.timeoutMs ?? 3500);
      pendingCommands.current.set(command.id, { page: options.page, action: options.action, targetOfficialPath: options.targetOfficialPath, startedAt, resolve, timeout });
      window.setTimeout(() => sendCommand(command), 220);
    });
  }, [openOfficialPath, sendCommand]);

  const addMarker = useCallback((label = marker) => setLogState((state) => appendMarker(state, label)), [marker]);
  const clearLogs = useCallback(() => setLogState((state) => ({ ...state, events: [], actions: [] })), []);
  const startSession = useCallback(() => setLogState((state) => state.session.active ? state : startCaptureSession(state)), []);
  const stopSession = useCallback(() => setLogState((state) => state.session.active ? stopCaptureSession(state) : state), []);
  const changeWebviewMode = useCallback((mode: WebviewMode) => setLogState((state) => setWebviewMode(state, mode)), []);
  const exportLogs = useCallback(() => {
    const blob = new Blob([exportLogJson(logState)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = timestampFilename();
    link.click();
    URL.revokeObjectURL(url);
  }, [logState]);

  const api: OverlayApi = useMemo(() => ({ openOfficialPath, runOverlayAction }), [openOfficialPath, runOverlayAction]);
  const content = page === "Dashboard"
    ? <Dashboard api={api} derived={derived} startSession={startSession} stopSession={stopSession} session={logState.session} />
    : page === "Lighting"
      ? <LightingPage api={api} derived={derived} />
      : page === "Performance"
        ? <PerformancePage api={api} derived={derived} />
        : page === "Advanced Keys"
          ? <AdvancedKeysPage api={api} />
          : page === "SOCD"
            ? <SocdPage api={api} />
            : page === "Keymap"
              ? <KeymapPage api={api} />
              : page === "Macros"
                ? <MacrosPage api={api} />
                : page === "Settings"
                  ? <SettingsPage theme={theme} setTheme={setThemePersisted} api={api} exportLogs={exportLogs} clearLogs={clearLogs} />
                  : page === "Official Driver"
                    ? <OfficialDriverPanel mode={logState.webviewMode} setMode={changeWebviewMode} api={api} />
                    : <LogsPage events={logState.events} actions={logState.actions} marker={marker} setMarker={setMarker} addMarker={addMarker} exportLogs={exportLogs} clearLogs={clearLogs} derived={derived} />;

  return (
    <div className="app" data-theme={theme.toLowerCase().replaceAll(" ", "-")}>
      <aside className="sidebar">
        <div className="brand"><div className="brandMark"><Zap size={18} /></div><div><strong>AK680</strong><span>Overlay Control</span></div></div>
        <nav>{pages.map((item) => {
          const Icon = item.icon;
          return <button className={page === item.name ? "active" : ""} key={item.name} onClick={() => setPage(item.name)}><Icon size={18} />{item.name}</button>;
        })}</nav>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div><h1>{bridge.metadata.name}</h1><p>{bridge.metadata.targetDevice}</p></div>
          <div className="statusRow">
            <span className="pill good">{derived.connectedDeviceStatus}</span>
            <span className="pill">Official {derived.currentRoute}</span>
            <span className="pill">Last {derived.lastOverlayAction?.status ?? "idle"}</span>
            <label className="selectLabel">Official View<select value={logState.webviewMode} onChange={(event) => changeWebviewMode(event.target.value as WebviewMode)}>{(["Docked", "Compact", "Hidden"] as WebviewMode[]).map((mode) => <option key={mode}>{mode}</option>)}</select></label>
            <select value={theme} onChange={(event) => setThemePersisted(event.target.value)}>{themes.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
        </header>
        <motion.main className="content" key={page} initial={{ opacity: 0, y: 10, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.22, ease: "easeOut" }}>{content}</motion.main>
      </section>
      <aside className="logDrawer"><UtilityDrawer derived={derived} actions={logState.actions} events={logState.events} exportLogs={exportLogs} /></aside>
      {toast && <div className="toast" onAnimationEnd={() => setToast(undefined)}>{toast}</div>}
      <OfficialWebviewHost ref={webviewRef} mode={logState.webviewMode} targetUrl={officialTargetUrl} addLogEvent={addLogEvent} updateOfficialUrl={updateOfficialUrl} openOfficialPath={openOfficialPath} setMode={changeWebviewMode} />
    </div>
  );
}

function Dashboard(props: { api: OverlayApi; derived: ReturnType<typeof deriveLogState>; session: { active: boolean }; startSession: () => void; stopSession: () => void }) {
  return (
    <div className="dashboard pageFade">
      <section className="keyboardShowcase">
        <div className="showcaseTop">
          <div className="deviceIdentity"><span className="deviceThumb" /><div><strong>AK680 V2</strong><p>{props.derived.deviceConnectStatus}</p></div></div>
          <div className="heroActions"><button className="primary" onClick={async () => { await props.api.runOverlayAction({ page: "Dashboard", action: "Detect official driver", targetOfficialPath: officialPaths.keymap, commandType: "detectOfficialState" }); await props.api.runOverlayAction({ page: "Dashboard", action: "Check remembered AK680 permission", targetOfficialPath: officialPaths.keymap, commandType: "getRememberedHidDevices" }); await props.api.runOverlayAction({ page: "Dashboard", action: "Connect AK680 V2", targetOfficialPath: officialPaths.keymap, commandType: "clickByText", text: "Connect", tag: "button" }); }}>Connect</button><button onClick={() => props.api.openOfficialPath(officialPaths.keymap, true)}>Official</button></div>
        </div>
        <Ak680KeyboardVisual />
        <div className="showcaseStats">
          <StatusChip label="Route" value={props.derived.currentRoute} />
          <StatusChip label="Last" value={props.derived.lastOverlayAction?.status ?? "Idle"} tone={props.derived.lastOverlayAction?.status === "success" ? "good" : props.derived.lastOverlayAction?.status === "failure" ? "bad" : "idle"} />
          <StatusChip label="Events" value={`${props.derived.eventCount}`} />
        </div>
      </section>
      <div className="commandGrid">
        <CommandTile title="Lighting" meta="Effects, color, speed" onClick={() => props.api.openOfficialPath(officialPaths.lighting)} />
        <CommandTile title="Performance" meta="Trigger and response" onClick={() => props.api.openOfficialPath(officialPaths.performance)} />
        <CommandTile title="Keymap" meta="Keys and layers" onClick={() => props.api.openOfficialPath(officialPaths.keymap)} />
        <CommandTile title="Advanced" meta="RS, DKS, SOCD" onClick={() => props.api.openOfficialPath(officialPaths.advancedKeys)} />
        <CommandTile title="Macros" meta="Record and assign" onClick={() => props.api.openOfficialPath(officialPaths.macros)} />
        <CommandTile title={props.session.active ? "Stop Capture" : "Capture"} meta={`${props.derived.eventCount} events`} onClick={props.session.active ? props.stopSession : props.startSession} />
      </div>
    </div>
  );
}

function Ak680KeyboardVisual({ selected }: { selected?: string }) {
  return (
    <div className="ak680Stage" aria-label="AK680 keyboard preview">
      <div className="ak680Handle" />
      <div className="ak680Board">
        {ak680Rows.map((row, rowIndex) => <div className="ak680Row" key={rowIndex}>{row.map((key, keyIndex) => <span className={`ak680Key ${keyClassName(key)} ${selected === key ? "selected" : ""}`} key={`${rowIndex}-${keyIndex}-${key}`}>{key}</span>)}</div>)}
        <div className="ak680Knob" />
      </div>
    </div>
  );
}

function keyClassName(key: string): string {
  if (key === "Space") return "space";
  if (key === "Backspace" || key === "Caps" || key === "Enter" || key === "Shift") return "wide";
  if (key === "Tab" || key === "\\" || key === "Home" || key === "Delete" || key === "PgUp" || key === "PgDn") return "mid";
  return "";
}

function StatusChip({ label, value, tone = "idle" }: { label: string; value: string; tone?: "good" | "bad" | "idle" }) {
  return <span className={`statusChip ${tone}`}><small>{label}</small>{value}</span>;
}

function CommandTile({ title, meta, onClick }: { title: string; meta: string; onClick: () => void }) {
  return <button className="commandTile" onClick={onClick}><span>{meta}</span><strong>{title}</strong></button>;
}

function LightingPage({ api, derived }: { api: OverlayApi; derived: ReturnType<typeof deriveLogState> }) {
  const [brightness, setBrightness] = useState(60);
  const [speed, setSpeed] = useState(50);
  const [mode, setMode] = useState("RGB");
  return (
    <div className="controlBoard pageFade">
      <PageIntro title="Lighting" note="Effects and color." path={officialPaths.lighting} api={api} />
      <section className="controlHero lightingHero">
        <div>
          <span className="eyebrow">Live</span>
          <h3>{derived.lastOverlayAction?.page === "Lighting" ? derived.lastOverlayAction.action : "Ready"}</h3>
        </div>
        <div className="statusChips">
          <StatusChip label="Route" value={derived.currentRoute} />
          <StatusChip label="Result" value={derived.lastOverlayAction?.status ?? "Idle"} tone={derived.lastOverlayAction?.status === "success" ? "good" : derived.lastOverlayAction?.status === "failure" ? "bad" : "idle"} />
        </div>
      </section>
      <div className="presetGrid">{lightingEffects.slice(0, 8).map((effect) => <button key={effect} className="presetTile" onClick={async () => { await api.runOverlayAction({ page: "Lighting", action: "Wait for Lighting page", targetOfficialPath: officialPaths.lighting, commandType: "waitForText", text: "Lighting" }); await api.runOverlayAction({ page: "Lighting", action: `Lighting effect ${effect}`, targetOfficialPath: officialPaths.lighting, commandType: "clickByText", text: effect }); }}><span>Effect</span><strong>{effect}</strong></button>)}</div>
      <div className="controlDock">
        <ControlPanel title="Brightness" value={brightness} setValue={setBrightness} onApply={(value) => api.runOverlayAction({ page: "Lighting", action: `Lighting Brightness ${value}`, targetOfficialPath: officialPaths.lighting, commandType: "setRangeByNearbyLabel", text: "Lighting Brightness", nearText: "Brightness", value })} />
        <ControlPanel title="Speed" value={speed} setValue={setSpeed} onApply={(value) => api.runOverlayAction({ page: "Lighting", action: `Lighting Speed ${value}`, targetOfficialPath: officialPaths.lighting, commandType: "setRangeByNearbyLabel", text: "Lighting Speed", nearText: "Speed", value })} />
        <section className="panel colorPanel"><span>Mode</span><div className="segmented">{["RGB", "Mono"].map((item) => <button className={mode === item ? "active" : ""} key={item} onClick={() => { setMode(item); void api.runOverlayAction({ page: "Lighting", action: `Color mode ${item}`, targetOfficialPath: officialPaths.lighting, commandType: "clickByText", text: item === "Mono" ? "Monochrome" : item }); }}>{item}</button>)}</div><div className="swatches">{colors.map((color) => <button key={color} style={{ background: color }} title={color} onClick={() => api.runOverlayAction({ page: "Lighting", action: `Color ${color}`, targetOfficialPath: officialPaths.lighting, commandType: "clickByText", text: color })} />)}</div></section>
      </div>
    </div>
  );
}

function PerformancePage({ api, derived }: { api: OverlayApi; derived: ReturnType<typeof deriveLogState> }) {
  const [trigger, setTrigger] = useState(12);
  const [deadTop, setDeadTop] = useState(5);
  const [deadBottom, setDeadBottom] = useState(5);
  return (
    <div className="controlBoard pageFade">
      <PageIntro title="Performance" note="Trigger, dead zone, presets." path={officialPaths.performance} api={api} />
      <section className="controlHero performanceHero">
        <div><span className="eyebrow">Tuning</span><h3>{derived.lastOverlayAction?.page === "Performance" ? derived.lastOverlayAction.action : "Balanced"}</h3></div>
        <div className="tabs">{["Normal", "Advanced", "Recalibrate"].map((tab) => <button key={tab} onClick={() => api.runOverlayAction({ page: "Performance", action: `Open ${tab}`, targetOfficialPath: officialPaths.performance, commandType: "clickByText", text: tab === "Advanced" ? "Advanced Settings" : tab })}>{tab}</button>)}</div>
      </section>
      <div className="presetGrid">{["Custom", "Office Mode", "Beginner Mode", "Game Mode"].map((preset) => <button className="presetTile" key={preset} onClick={async () => { await api.runOverlayAction({ page: "Performance", action: "Wait for Performance page", targetOfficialPath: officialPaths.performance, commandType: "waitForText", text: "Performance" }); await api.runOverlayAction({ page: "Performance", action: `Preset ${preset}`, targetOfficialPath: officialPaths.performance, commandType: "clickByText", text: preset }); }}><span>Preset</span><strong>{preset.replace(" Mode", "")}</strong></button>)}</div>
      <div className="controlDock">
        <ControlPanel title="Trigger Distance" value={trigger} setValue={setTrigger} onApply={(value) => api.runOverlayAction({ page: "Performance", action: `Trigger Distance ${value}`, targetOfficialPath: officialPaths.performance, commandType: "setRangeByNearbyLabel", text: "Trigger Distance", nearText: "Trigger", value })} />
        <section className="panel fastTrigger"><span>Fast Trigger</span><strong>{derived.lastOverlayAction?.action === "Fast Trigger" ? "Requested" : "Ready"}</strong><button onClick={() => api.runOverlayAction({ page: "Performance", action: "Fast Trigger", targetOfficialPath: officialPaths.performance, commandType: "setToggleByLabel", text: "Fast Trigger" })}>Toggle</button></section>
        <ControlPanel title="Top Dead Zone" value={deadTop} setValue={setDeadTop} onApply={(value) => api.runOverlayAction({ page: "Performance", action: `Top Dead Zone ${value}`, targetOfficialPath: officialPaths.performance, commandType: "setRangeByNearbyLabel", text: "Top Dead Zone", nearText: "Dead Zone", value })} />
        <ControlPanel title="Bottom Dead Zone" value={deadBottom} setValue={setDeadBottom} onApply={(value) => api.runOverlayAction({ page: "Performance", action: `Bottom Dead Zone ${value}`, targetOfficialPath: officialPaths.performance, commandType: "setRangeByNearbyLabel", text: "Bottom Dead Zone", nearText: "Dead Zone", value })} />
      </div>
    </div>
  );
}

function AdvancedKeysPage({ api }: { api: OverlayApi }) {
  const [module, setModule] = useState(advancedModules[0]);
  const [actuation, setActuation] = useState(18);
  const openModule = (name = module) => api.runOverlayAction({ page: "Advanced Keys", action: `Open ${name}`, targetOfficialPath: officialPaths.advancedKeys, commandType: "clickByText", text: name === "RS / Snappy" ? "RS" : name });
  return (
    <div className="stack pageFade">
      <PageIntro title="Advanced Keys" note="Tune advanced key behavior through the official driver." path={officialPaths.advancedKeys} api={api} />
      <div className="advancedWorkspace">
        <section className="panel advancedModulePanel">
          <span>Module</span>
          <strong>{module}</strong>
          <div className="moduleGrid">{advancedModules.map((item) => <button className={module === item ? "active" : ""} key={item} onClick={() => { setModule(item); void openModule(item); }}>{item}</button>)}</div>
        </section>
        <section className="advancedActions">
          <ControlPanel title="Trigger Point" value={actuation} setValue={setActuation} onApply={async (value) => { await openModule(); await api.runOverlayAction({ page: "Advanced Keys", action: `${module} Trigger ${value}`, targetOfficialPath: officialPaths.advancedKeys, commandType: "setRangeByNearbyLabel", text: module, nearText: "Trigger", value }); }} />
          <button className="panel actionPanel" onClick={async () => { await openModule(); await api.runOverlayAction({ page: "Advanced Keys", action: `Enable ${module}`, targetOfficialPath: officialPaths.advancedKeys, commandType: "setToggleByLabel", text: "Enable" }); }}><span>Toggle</span><strong>Enable</strong><p>Turns on the selected module if the official toggle is visible.</p></button>
          <button className="panel actionPanel" onClick={async () => { await openModule(); await api.runOverlayAction({ page: "Advanced Keys", action: `Save ${module}`, targetOfficialPath: officialPaths.advancedKeys, commandType: "clickByText", text: "Save" }); }}><span>Commit</span><strong>Save</strong><p>Uses the official driver save action.</p></button>
        </section>
      </div>
    </div>
  );
}

function SocdPage({ api }: { api: OverlayApi }) {
  const [mode, setMode] = useState(socdModes[0]);
  const applyMode = async () => {
    await api.runOverlayAction({ page: "SOCD", action: "Open SOCD panel", targetOfficialPath: officialPaths.advancedKeys, commandType: "clickByText", text: "SOCD" });
    if (mode === "Off") {
      await api.runOverlayAction({ page: "SOCD", action: "Disable SOCD", targetOfficialPath: officialPaths.advancedKeys, commandType: "setToggleByLabel", text: "SOCD" });
      return;
    }
    await api.runOverlayAction({ page: "SOCD", action: `Set ${mode}`, targetOfficialPath: officialPaths.advancedKeys, commandType: "clickByText", text: mode });
  };
  return (
    <div className="stack pageFade">
      <PageIntro title="SOCD" note="Select a mode, then let the official advanced-key page apply it." path={officialPaths.advancedKeys} api={api} />
      <div className="socdWorkspace">
        <section className="panel socdModePanel">
          <span>Mode</span>
          <strong>{mode}</strong>
          <div className="modeList">{socdModes.map((item) => <button className={mode === item ? "active" : ""} key={item} onClick={() => setMode(item)}>{item}</button>)}</div>
        </section>
        <section className="panel socdApplyPanel">
          <span>Apply</span>
          <strong>SOCD via official driver</strong>
          <p>Opens the SOCD area in Advanced Keys and selects the visible official mode.</p>
          <div className="actions"><button className="primary" onClick={applyMode}>Apply Mode</button><button onClick={() => api.openOfficialPath(officialPaths.advancedKeys, true)}>Official View</button></div>
        </section>
      </div>
    </div>
  );
}

function KeymapPage({ api }: { api: OverlayApi }) {
  const [selected, setSelected] = useState("ESC");
  const [assignment, setAssignment] = useState("Backspace");
  const applyAssignment = async () => {
    await api.runOverlayAction({ page: "Keymap", action: `Select ${selected}`, targetOfficialPath: officialPaths.keymap, commandType: "clickByText", text: selected });
    const inputResult = await api.runOverlayAction({ page: "Keymap", action: `Search assignment ${assignment}`, targetOfficialPath: officialPaths.keymap, commandType: "setInputValue", text: "Key", value: assignment });
    if (!inputResult.success) {
      await api.runOverlayAction({ page: "Keymap", action: `Find assignment ${assignment}`, targetOfficialPath: officialPaths.keymap, commandType: "clickByText", text: assignment });
      return;
    }
    await api.runOverlayAction({ page: "Keymap", action: `Apply ${assignment} to ${selected}`, targetOfficialPath: officialPaths.keymap, commandType: "clickByText", text: assignment });
  };
  return (
    <div className="stack pageFade">
      <PageIntro title="Keymap" note="Pick a key, choose a common mapping, let the official driver apply it." path={officialPaths.keymap} api={api} />
      <div className="keymapLayout">
        <section className="keyboardCard">
          <div className="keymapHeader"><span>Selected key</span><strong>{selected}</strong></div>
          <div className="keys">{Array.from({ length: 68 }, (_, index) => <button key={index} className={selected === keyLabel(index) ? "active" : ""} onClick={() => setSelected(keyLabel(index))}>{keyLabel(index)}</button>)}</div>
        </section>
        <section className="panel assignmentPanel">
          <span>Assignment</span>
          <strong>{selected} {"->"} {assignment}</strong>
          <select value={assignment} onChange={(event) => setAssignment(event.target.value)}>{keyAssignments.map((item) => <option key={item}>{item}</option>)}</select>
          <div className="assignmentGrid">{keyAssignments.slice(0, 8).map((item) => <button className={assignment === item ? "active" : ""} key={item} onClick={() => setAssignment(item)}>{item}</button>)}</div>
          <div className="actions"><button className="primary" onClick={applyAssignment}>Apply Mapping</button><button onClick={() => api.openOfficialPath(officialPaths.keymap, true)}>Official View</button></div>
        </section>
      </div>
    </div>
  );
}

function MacrosPage({ api }: { api: OverlayApi }) {
  const [slot, setSlot] = useState(macroSlots[0]);
  const [target, setTarget] = useState(macroTargets[0]);
  const createMacro = async () => {
    await api.runOverlayAction({ page: "Macros", action: "Open Macro Manager", targetOfficialPath: officialPaths.macros, commandType: "clickByText", text: "Macro" });
    const nameResult = await api.runOverlayAction({ page: "Macros", action: `Name macro ${slot}`, targetOfficialPath: officialPaths.macros, commandType: "setInputValue", text: "Name", value: slot });
    if (!nameResult.success) {
      await api.runOverlayAction({ page: "Macros", action: "New Macro", targetOfficialPath: officialPaths.macros, commandType: "clickByText", text: "New" });
    }
  };
  const recordMacro = async () => {
    await api.runOverlayAction({ page: "Macros", action: `Select macro ${slot}`, targetOfficialPath: officialPaths.macros, commandType: "clickByText", text: slot });
    await api.runOverlayAction({ page: "Macros", action: "Start recording", targetOfficialPath: officialPaths.macros, commandType: "clickByText", text: "Record" });
  };
  const saveMacro = async () => {
    await api.runOverlayAction({ page: "Macros", action: "Stop recording", targetOfficialPath: officialPaths.macros, commandType: "clickByText", text: "Stop" });
    await api.runOverlayAction({ page: "Macros", action: "Save macro", targetOfficialPath: officialPaths.macros, commandType: "clickByText", text: "Save" });
  };
  const assignMacro = async () => {
    await api.runOverlayAction({ page: "Macros", action: `Select macro ${slot}`, targetOfficialPath: officialPaths.macros, commandType: "clickByText", text: slot });
    await api.runOverlayAction({ page: "Macros", action: `Assign macro to ${target}`, targetOfficialPath: officialPaths.macros, commandType: "clickByText", text: target });
  };
  return (
    <div className="stack pageFade">
      <PageIntro title="Macros" note="Build and assign macros through the official driver." path={officialPaths.macros} api={api} />
      <div className="macroWorkspace">
        <section className="panel macroComposer">
          <span>Macro slot</span>
          <strong>{slot}</strong>
          <div className="macroSlots">{macroSlots.map((item) => <button className={slot === item ? "active" : ""} key={item} onClick={() => setSlot(item)}>{item}</button>)}</div>
          <label className="fieldLabel">Assign to<select value={target} onChange={(event) => setTarget(event.target.value)}>{macroTargets.map((item) => <option key={item}>{item}</option>)}</select></label>
        </section>
        <section className="macroActions">
          <button className="panel actionPanel" onClick={createMacro}><span>Step 1</span><strong>Create</strong><p>Name or open the selected macro slot.</p></button>
          <button className="panel actionPanel" onClick={recordMacro}><span>Step 2</span><strong>Record</strong><p>Starts official macro recording if visible.</p></button>
          <button className="panel actionPanel" onClick={saveMacro}><span>Step 3</span><strong>Save</strong><p>Stops and saves through the official page.</p></button>
          <button className="panel actionPanel" onClick={assignMacro}><span>Step 4</span><strong>Assign</strong><p>Maps {slot} to {target} where exposed.</p></button>
        </section>
      </div>
    </div>
  );
}

function SettingsPage(props: { theme: string; setTheme: (theme: string) => void; api: OverlayApi; exportLogs: () => void; clearLogs: () => void }) {
  const [returnRate, setReturnRate] = useState("1000Hz");
  const [stability, setStability] = useState(true);
  const [calibration, setCalibration] = useState(true);
  const applyDeviceSettings = async () => {
    await props.api.runOverlayAction({ page: "Settings", action: `Return Rate ${returnRate}`, targetOfficialPath: officialPaths.settings, commandType: "clickByText", text: "Return Rate" });
    await props.api.runOverlayAction({ page: "Settings", action: `Select ${returnRate}`, targetOfficialPath: officialPaths.settings, commandType: "clickByText", text: returnRate });
    if (stability) await props.api.runOverlayAction({ page: "Settings", action: "Enable Stability Mode", targetOfficialPath: officialPaths.settings, commandType: "setToggleByLabel", text: "Stability Mode" });
    if (calibration) await props.api.runOverlayAction({ page: "Settings", action: "Enable Adaptive Dynamic Calibration", targetOfficialPath: officialPaths.settings, commandType: "setToggleByLabel", text: "Adaptive Dynamic Calibration" });
  };
  return (
    <div className="stack pageFade">
      <PageIntro title="Settings" note="Device preferences and app options." path={officialPaths.settings} api={props.api} />
      <div className="settingsWorkspace">
        <section className="panel deviceSettingsPanel">
          <span>Device</span>
          <strong>{returnRate}</strong>
          <div className="rateGrid">{returnRates.map((item) => <button className={returnRate === item ? "active" : ""} key={item} onClick={() => setReturnRate(item)}>{item}</button>)}</div>
          <label className="toggleRow"><input type="checkbox" checked={stability} onChange={(event) => setStability(event.target.checked)} />Stability Mode</label>
          <label className="toggleRow"><input type="checkbox" checked={calibration} onChange={(event) => setCalibration(event.target.checked)} />Adaptive Calibration</label>
          <button className="primary" onClick={applyDeviceSettings}>Apply Device Settings</button>
        </section>
        <section className="panel appSettingsPanel">
          <span>App</span>
          <strong>Theme and diagnostics</strong>
          <label className="fieldLabel">Theme<select value={props.theme} onChange={(event) => props.setTheme(event.target.value)}>{themes.map((item) => <option key={item}>{item}</option>)}</select></label>
          <div className="actions"><button onClick={props.exportLogs}>Export Diagnostics</button><button onClick={props.clearLogs}>Clear Activity</button></div>
          <button onClick={() => props.api.openOfficialPath(officialPaths.settings, true)}>Open Official Settings</button>
        </section>
        <section className="panel resetPanel">
          <span>Reset</span>
          <strong>Keyboard reset</strong>
          <p>Opens the official reset area only. The final reset action remains inside the official driver.</p>
          <button onClick={() => props.api.runOverlayAction({ page: "Settings", action: "Open Reset Settings", targetOfficialPath: officialPaths.settings, commandType: "clickByText", text: "Reset" })}>Open Reset Area</button>
        </section>
      </div>
      <AdapterInspector api={props.api} />
    </div>
  );
}

function RouteCards({ page, path, api, cards }: { page: Page; path: OfficialPath; api: OverlayApi; cards: string[] }) {
  return <div className="stack pageFade"><PageIntro title={page} note="Route-backed controls. Cards click matching visible official text when possible." path={path} api={api} /><div className="grid three">{cards.map((card) => <button className="panel actionPanel" key={card} onClick={() => api.runOverlayAction({ page, action: `Open ${card}`, targetOfficialPath: path, commandType: "clickByText", text: card })}><span>Official card</span><strong>{card}</strong><p>Best-effort DOM adapter</p></button>)}</div></div>;
}

function PageIntro({ title, note, path, api }: { title: string; note: string; path: OfficialPath; api: OverlayApi }) {
  return <section className="pageIntro"><div><span className="eyebrow">Control</span><h2>{title}</h2><p>{note}</p></div><div className="heroActions"><button className="primary" onClick={() => api.runOverlayAction({ page: title as Page, action: `Open ${path}`, targetOfficialPath: path, commandType: "navigateToPath" })}>Prepare</button><button onClick={() => api.openOfficialPath(path, true)}>Official</button></div></section>;
}

function OfficialDriverPanel({ mode, setMode, api }: { mode: WebviewMode; setMode: (mode: WebviewMode) => void; api: OverlayApi }) {
  return <div className="stack pageFade"><div className="notice">The official webview remains mounted. Docked shows it full-size, Compact shows an inspector, Hidden de-emphasizes it while overlay pages control it.</div><div className="actions">{(["Docked", "Compact", "Hidden"] as WebviewMode[]).map((item) => <button className={mode === item ? "primary" : ""} key={item} onClick={() => setMode(item)}>{item}</button>)}</div><AdapterInspector api={api} /></div>;
}

function AdapterInspector({ api }: { api: OverlayApi }) {
  const [lastResult, setLastResult] = useState<WebviewCommandResult | undefined>();
  const run = async (label: string, commandType: WebviewCommandType) => {
    const result = await api.runOverlayAction({ page: "Settings", action: label, targetOfficialPath: officialPaths.home, commandType });
    setLastResult(result);
  };
  return <section className="panel inspectorPanel"><span>Adapter Inspector</span><strong>Live DOM discovery</strong><p>Developer-only snapshots for tuning adapters. No cookies, storage, auth headers, or full HTML are collected.</p><div className="actions"><button onClick={() => run("Snapshot visible buttons", "snapshotVisibleButtons")}>Snapshot visible buttons</button><button onClick={() => run("Snapshot visible inputs", "snapshotVisibleInputs")}>Snapshot visible inputs</button><button onClick={() => run("Snapshot visible tabs", "snapshotVisibleTabs")}>Snapshot visible tabs</button><button onClick={() => run("Snapshot page text summary", "snapshotPageTextSummary")}>Snapshot page text summary</button><button onClick={() => run("Snapshot active elements", "snapshotActiveElements")}>Snapshot selected/active elements</button></div>{lastResult && <pre className="inspectorOutput">{JSON.stringify(lastResult.details ?? lastResult.snapshot ?? lastResult, null, 2)}</pre>}</section>;
}

const OfficialWebviewHost = React.forwardRef<ElectronWebview | null, { mode: WebviewMode; targetUrl: string; addLogEvent: (payload: unknown) => void; updateOfficialUrl: (url: string, type?: string) => void; openOfficialPath: (path?: OfficialPath, switchPage?: boolean) => void; setMode: (mode: WebviewMode) => void }>(function OfficialWebviewHost(props, ref) {
  const localRef = useRef<ElectronWebview | null>(null);
  const initialUrl = useRef(props.targetUrl);
  const addLogEventRef = useRef(props.addLogEvent);
  const updateOfficialUrlRef = useRef(props.updateOfficialUrl);
  const openOfficialPathRef = useRef(props.openOfficialPath);
  const setModeRef = useRef(props.setMode);
  const [domReady, setDomReady] = useState(false);
  const [webviewError, setWebviewError] = useState<string | undefined>();
  const [loadState, setLoadState] = useState<OfficialLoadState>("loading");
  const [statusMessage, setStatusMessage] = useState("Loading official driver...");
  const routeRepairCount = useRef(0);
  const pendingPath = useRef<OfficialPath | undefined>();
  const readinessTimer = useRef<number | undefined>();
  const lastLifecycleLog = useRef("");

  useEffect(() => {
    addLogEventRef.current = props.addLogEvent;
    updateOfficialUrlRef.current = props.updateOfficialUrl;
    openOfficialPathRef.current = props.openOfficialPath;
    setModeRef.current = props.setMode;
  }, [props.addLogEvent, props.updateOfficialUrl, props.openOfficialPath, props.setMode]);

  useEffect(() => {
    if (typeof ref === "function") ref(localRef.current);
    else if (ref) ref.current = localRef.current;
  });

  useEffect(() => {
    const webview = localRef.current;
    if (!webview) return;

    const logWebviewEvent = (eventName: string) => {
      const url = safeWebviewUrl(webview);
      const key = `${eventName}:${officialPathname(url)}`;
      if (lastLifecycleLog.current !== key) {
        console.log(`[ak680-webview] ${eventName}`, url);
        lastLifecycleLog.current = key;
      }
      updateOfficialUrlRef.current(url, eventName);
    };

    const loadOfficialPath = (path: OfficialPath, options: { auto?: boolean } = {}) => {
      const currentPath = officialPathname(safeWebviewUrl(webview));
      if (currentPath === path || pendingPath.current === path) return;
      pendingPath.current = path;
      if (options.auto) setStatusMessage("Opening Custom Keys...");
      void webview.loadURL?.(toOfficialUrl(path)).catch((error) => {
        pendingPath.current = undefined;
        setLoadState("failed");
        setWebviewError(String(error));
      });
    };

    const ensureUsefulRoute = () => {
      const url = safeWebviewUrl(webview);
      const path = officialPathname(url);
      if (path === "/") {
        if (routeRepairCount.current > 0) {
          setStatusMessage("Official driver loaded but this route rendered a blank area. Try Reload or Open Custom Keys.");
          return;
        }
        routeRepairCount.current += 1;
        loadOfficialPath(officialPaths.keymap, { auto: true });
        return;
      }
      if (path === officialPaths.keymap || path === officialPaths.lighting || path === officialPaths.performance || path === officialPaths.advancedKeys || path === officialPaths.macros || path === officialPaths.settings) {
        setStatusMessage("Official driver loaded");
      }
    };

    const checkCustomKeysReadiness = () => {
      window.clearTimeout(readinessTimer.current);
      if (officialPathname(safeWebviewUrl(webview)) !== officialPaths.keymap) return;
      readinessTimer.current = window.setTimeout(() => {
        const command = createCommand("waitForText", { text: "Custom Keys", timeoutMs: 2200 });
        try {
          webview.send?.("ak680-command", command);
        } catch {
          setStatusMessage("Official route loaded; adapter readiness not confirmed");
        }
      }, 250);
    };

    const ready = () => {
      setDomReady(true);
      setLoadState("loaded");
      setWebviewError(undefined);
      logWebviewEvent("dom-ready");
      ensureUsefulRoute();
      checkCustomKeysReadiness();
    };
    const ipc = (event: Event) => {
      const detail = event as Event & { channel?: string; args?: unknown[] };
      if (detail.channel === "ak680-log-event") {
        const result = commandResultFromPayload(detail.args?.[0]);
        if (result?.command === "waitForText") {
          setStatusMessage(result.success ? "Official driver loaded" : "Official route loaded; adapter readiness not confirmed");
        }
        addLogEventRef.current(detail.args?.[0]);
      }
    };

    const nav = (event: Event) => {
      const current = event.currentTarget as ElectronWebview;
      const url = safeWebviewUrl(current);
      console.log(`[ak680-webview] ${event.type}`, url);
      updateOfficialUrlRef.current(url, event.type);
      const path = officialPathname(url);
      if (path === pendingPath.current) pendingPath.current = undefined;
      ensureUsefulRoute();
    };

    const fail = (event: Event) => {
      const detail = event as Event & { errorDescription?: string; validatedURL?: string };
      console.log("[ak680-webview] did-fail-load", detail.errorDescription, detail.validatedURL);
      pendingPath.current = undefined;
      setLoadState("failed");
      setWebviewError(detail.errorDescription ?? "Official webview failed to load");
      setStatusMessage("Official page failed to load");
    };

    const start = () => {
      setLoadState("loading");
      setStatusMessage("Loading official driver...");
      logWebviewEvent("did-start-loading");
    };

    const stop = () => {
      setLoadState("loaded");
      logWebviewEvent("did-stop-loading");
    };

    const finish = () => {
      pendingPath.current = undefined;
      setLoadState("loaded");
      logWebviewEvent("did-finish-load");
      ensureUsefulRoute();
      checkCustomKeysReadiness();
    };

    webview.addEventListener("dom-ready", ready);
    webview.addEventListener("ipc-message", ipc);
    webview.addEventListener("did-start-loading", start);
    webview.addEventListener("did-stop-loading", stop);
    webview.addEventListener("did-finish-load", finish);
    webview.addEventListener("did-navigate", nav);
    webview.addEventListener("did-navigate-in-page", nav);
    webview.addEventListener("page-title-updated", nav);
    webview.addEventListener("did-fail-load", fail);
    return () => {
      webview.removeEventListener("dom-ready", ready);
      webview.removeEventListener("ipc-message", ipc);
      webview.removeEventListener("did-start-loading", start);
      webview.removeEventListener("did-stop-loading", stop);
      webview.removeEventListener("did-finish-load", finish);
      webview.removeEventListener("did-navigate", nav);
      webview.removeEventListener("did-navigate-in-page", nav);
      webview.removeEventListener("page-title-updated", nav);
      webview.removeEventListener("did-fail-load", fail);
      window.clearTimeout(readinessTimer.current);
    };
  }, []);

  useEffect(() => {
    const webview = localRef.current;
    if (!domReady || !webview?.loadURL) return;
    const targetPath = pathFromUrl(props.targetUrl);
    const currentPath = officialPathname(safeWebviewUrl(webview));
    if (currentPath === targetPath || pendingPath.current === targetPath) return;
    pendingPath.current = targetPath;
    void webview.loadURL(props.targetUrl).catch((error) => {
      pendingPath.current = undefined;
      setLoadState("failed");
      setWebviewError(String(error));
    });
  }, [domReady, props.targetUrl]);

  const openInWebview = (path: OfficialPath) => {
    routeRepairCount.current = path === officialPaths.keymap ? 0 : routeRepairCount.current;
    const url = toOfficialUrl(path);
    openOfficialPathRef.current(path, false);
    const webview = localRef.current;
    if (!webview?.loadURL) return;
    if (officialPathname(safeWebviewUrl(webview)) === path || pendingPath.current === path) return;
    pendingPath.current = path;
    void webview.loadURL(url).catch((error) => {
      pendingPath.current = undefined;
      setLoadState("failed");
      setWebviewError(String(error));
    });
  };

  const reloadCustomKeys = () => openInWebview(officialPaths.keymap);

  const reloadCurrent = () => {
    routeRepairCount.current = 0;
    if (localRef.current?.reload) localRef.current.reload();
    else reloadCustomKeys();
  };

  return (
    <div className={`officialHost ${props.mode.toLowerCase()}`}>
      <div className="officialHostBar">
        <span>{statusLabel(loadState)} - {pathFromUrl(safeWebviewUrl(localRef.current))}</span>
        <button onClick={reloadCurrent}>Reload</button>
        <button onClick={reloadCustomKeys}>Open Custom Keys</button>
        <button onClick={() => openInWebview(officialPaths.lighting)}>Open Lighting</button>
        <button onClick={() => openInWebview(officialPaths.performance)}>Open Performance</button>
        <button onClick={() => openInWebview(officialPaths.advancedKeys)}>Open Advanced Keys</button>
        <button onClick={() => setModeRef.current("Docked")}>Open Official Driver Page</button>
      </div>
      <div className="officialRouteBanner">{statusMessage}</div>
      <webview ref={(node) => { localRef.current = node as ElectronWebview | null; }} src={initialUrl.current} preload={bridge.metadata.webviewPreloadPath} allow="hid" partition="persist:ajazz-official" />
      {webviewError && <div className="webviewError"><strong>Official page failed to load</strong><span>{webviewError}</span><div className="actions compact"><button onClick={reloadCustomKeys}>Reload Custom Keys</button><button onClick={() => setModeRef.current("Docked")}>Open Official View</button></div></div>}
    </div>
  );
});

function LogsPage(props: { events: OverlayLogEvent[]; actions: OverlayAction[]; marker: string; setMarker: (marker: string) => void; addMarker: (label?: string) => void; exportLogs: () => void; clearLogs: () => void; derived: ReturnType<typeof deriveLogState> }) {
  const [filter, setFilter] = useState<Filter>("All");
  const events = filterEvents(props.events, filter);
  return <div className="logs full pageFade"><div className="logsHeader"><div><h2>Diagnostics & Actions</h2><p>{props.derived.eventCount} activity events and {props.actions.length} adapter actions.</p></div><div className="actions"><button onClick={props.exportLogs}>Export Diagnostics</button><button onClick={props.clearLogs}>Clear Activity</button></div></div><FilterTabs filter={filter} setFilter={setFilter} /><QuickMarkers addMarker={(label) => props.addMarker(label)} /><MarkerInput marker={props.marker} setMarker={props.setMarker} addMarker={props.addMarker} /><ActionHistoryPanel actions={props.actions} /><EventList events={events} /></div>;
}

function UtilityDrawer({ derived, actions, events, exportLogs }: { derived: ReturnType<typeof deriveLogState>; actions: OverlayAction[]; events: OverlayLogEvent[]; exportLogs: () => void }) {
  return <div className="logs"><div className="drawerTitle"><h3>Diagnostics</h3><span className="sessionDot">Secondary</span></div><div className="miniStats"><span>{derived.deviceConnectStatus}</span><span>Route {derived.currentRoute}</span><span>Last {derived.lastOverlayAction?.status ?? "none"}</span><span>{events.length} activity events</span></div><ActionHistoryPanel actions={actions.slice(0, 5)} compact /><button onClick={exportLogs}>Export Diagnostics</button></div>;
}

function ActionHistoryPanel({ actions, compact = false }: { actions: OverlayAction[]; compact?: boolean }) {
  return <div className="actionHistory">{actions.length === 0 && <div className="empty">No overlay actions yet.</div>}{actions.map((action) => <div className={`actionRow ${action.status}`} key={action.id}><ActionStatusBadge status={action.status} /><div className="actionCopy"><strong>{action.action}</strong>{!compact && <span>{action.page} - {action.targetOfficialPath}</span>}<p>{action.message}</p></div><time>{new Date(action.timestamp).toLocaleTimeString()}</time></div>)}</div>;
}

function ActionStatusBadge({ status }: { status: OverlayActionStatus }) {
  const Icon = status === "success" ? CheckCircle2 : status === "failure" ? XCircle : Loader2;
  return <span className={`actionBadge ${status}`}><Icon size={14} />{status}</span>;
}

function ControlPanel({ title, value, setValue, onApply }: { title: string; value: number; setValue: (value: number) => void; onApply: (value: number) => void }) {
  return <section className="control"><div className="controlLabel"><label>{title}</label><strong>{value}</strong></div><input type="range" min="0" max="100" value={value} onChange={(event) => setValue(Number(event.target.value))} /><button onClick={() => onApply(value)}>Apply</button></section>;
}

function MarkerInput(props: { marker: string; setMarker: (marker: string) => void; addMarker: (label?: string) => void }) {
  return <div className="markerInput"><input list="markers" value={props.marker} onChange={(event) => props.setMarker(event.target.value)} /><datalist id="markers">{markerExamples.map((item) => <option key={item} value={item} />)}</datalist><button onClick={() => props.addMarker()}>Add Marker</button></div>;
}

function QuickMarkers(props: { addMarker: (label: string) => void }) {
  return <div className="quickMarkers">{markerExamples.map((label) => <button key={label} onClick={() => props.addMarker(label)}>{label}</button>)}</div>;
}

function FilterTabs(props: { filter: Filter; setFilter: (filter: Filter) => void }) {
  const filters: Filter[] = ["All", "HID", "DOM", "Markers", "Errors", "Actions"];
  return <div className="filterTabs">{filters.map((filter) => <button key={filter} className={props.filter === filter ? "active" : ""} onClick={() => props.setFilter(filter)}>{filter}</button>)}</div>;
}

function EventList({ events }: { events: OverlayLogEvent[] }) {
  return <div className="eventTable">{events.length === 0 && <div className="empty">No matching log events.</div>}{events.slice(0, 200).map((event) => <div className={`event ${event.phase === "error" || event.error ? "isError" : ""}`} key={event.id}><div className="eventMain"><time>{new Date(event.timestamp).toLocaleTimeString()}</time><span className={`source ${badgeClass(event)}`}>{badgeLabel(event)}</span><strong>{event.summary}</strong><span>{event.reportId !== undefined ? `r${event.reportId}` : "-"}</span><span>{event.length !== undefined ? `${event.length} bytes` : "-"}</span><code>{event.hex ? event.hex.split(" ").slice(0, 16).join(" ") : event.markerLabel ?? event.text ?? "-"}</code></div></div>)}</div>;
}

function filterEvents(events: OverlayLogEvent[], filter: Filter): OverlayLogEvent[] {
  if (filter === "HID") return events.filter((event) => event.source === "webhid");
  if (filter === "DOM") return events.filter((event) => event.source === "dom");
  if (filter === "Markers") return events.filter((event) => event.source === "marker");
  if (filter === "Errors") return events.filter((event) => event.phase === "error" || Boolean(event.error));
  if (filter === "Actions") return events.filter((event) => event.type === "adapter-command");
  return events;
}

function badgeLabel(event: OverlayLogEvent): string {
  if (event.phase === "error" || event.error) return "error";
  if (event.source === "host" && event.type.includes("permission")) return "permission";
  return event.source;
}

function badgeClass(event: OverlayLogEvent): string {
  return badgeLabel(event).replace("webhid", "webhid");
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return <article className="panel"><span>{title}</span><strong>{value}</strong><p>{note}</p></article>;
}

function keyLabel(index: number): string {
  return index === 0 ? "ESC" : index % 12 === 0 ? "Fn" : String(index + 1);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function readInitialTheme(): string {
  try {
    const stored = localStorage.getItem("ak680-theme");
    return stored && themes.includes(stored) ? stored : themes[0];
  } catch {
    return themes[0];
  }
}

function safeWebviewUrl(webview: ElectronWebview | null): string {
  try {
    return webview?.getURL?.() || bridge.metadata.officialDriverUrl;
  } catch {
    return bridge.metadata.officialDriverUrl;
  }
}

function officialPathname(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return "/";
  }
}

function statusLabel(state: OfficialLoadState): string {
  if (state === "loading") return "Loading official driver";
  if (state === "loaded") return "Official driver loaded";
  if (state === "failed") return "Official page failed to load";
  return "Official route unsupported/blank";
}

const root = document.getElementById("root");
if (!root) {
  document.body.innerHTML = "<div style=\"color:white;padding:24px;font-family:sans-serif\">Renderer failed to load: missing #root</div>";
} else {
  createRoot(root).render(<ErrorBoundary><App /></ErrorBoundary>);
}
