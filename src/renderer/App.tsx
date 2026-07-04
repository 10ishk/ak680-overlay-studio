import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Brush,
  Gauge,
  Keyboard,
  ListTodo,
  MonitorUp,
  Settings,
  Shield,
  SlidersHorizontal,
  TerminalSquare,
  Zap
} from "lucide-react";
import { getBridge } from "../bridge/ak680Bridge";
import {
  appendEvent,
  appendMarker,
  appendOverlayAction,
  deriveLogState,
  exportLogJson,
  initialLogState,
  normalizeGuestEvent,
  OverlayAction,
  OverlayLogEvent,
  setWebviewMode,
  startCaptureSession,
  stopCaptureSession,
  timestampFilename,
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
  send?: (channel: string, ...args: unknown[]) => void;
};

type PendingCommand = {
  page: Page;
  action: string;
  targetOfficialPath: OfficialPath;
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

function App() {
  const [page, setPage] = useState<Page>("Dashboard");
  const [theme, setTheme] = useState(() => localStorage.getItem("ak680-theme") ?? themes[0]);
  const [logState, setLogState] = useState(initialLogState);
  const [marker, setMarker] = useState(markerExamples[0]);
  const [officialTargetUrl, setOfficialTargetUrl] = useState(bridge.metadata.officialDriverUrl);
  const [toast, setToast] = useState<string | undefined>();
  const webviewRef = useRef<ElectronWebview | null>(null);
  const pendingCommands = useRef(new Map<string, PendingCommand>());
  const derived = useMemo(() => deriveLogState(logState), [logState]);

  const setThemePersisted = useCallback((nextTheme: string) => {
    setTheme(nextTheme);
    localStorage.setItem("ak680-theme", nextTheme);
  }, []);

  const addLogEvent = useCallback((payload: unknown) => {
    const result = commandResultFromPayload(payload);
    if (result) {
      const pending = pendingCommands.current.get(result.id);
      if (pending) {
        window.clearTimeout(pending.timeout);
        pendingCommands.current.delete(result.id);
        setLogState((state) => appendOverlayAction(state, {
          page: pending.page,
          action: pending.action,
          targetOfficialPath: pending.targetOfficialPath,
          status: result.success ? "success" : "failure",
          message: result.message,
          matchedText: result.matchedText,
          selector: result.selector
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
    setLogState((state) => appendEvent({ ...state, officialUrl: url }, normalizeGuestEvent({ source: "host", type, phase: "event", url, summary: `Official webview ${type}` }, url)));
  }, []);

  const openOfficialPath = useCallback((path: OfficialPath = pathFromUrl(logState.officialUrl), switchToOfficial = false) => {
    const url = toOfficialUrl(path);
    setOfficialTargetUrl(url);
    if (switchToOfficial) setPage("Official Driver");
    setLogState((state) => appendEvent({ ...state, officialUrl: url }, normalizeGuestEvent({ source: "host", type: "route-open", phase: "event", url, summary: `Open official route ${path}` }, url)));
  }, [logState.officialUrl]);

  const sendCommand = useCallback((command: WebviewCommand): void => {
    webviewRef.current?.send?.("ak680-command", command);
  }, []);

  const runOverlayAction = useCallback((options: RunActionOptions): Promise<WebviewCommandResult> => {
    openOfficialPath(options.targetOfficialPath, false);
    const command = createCommand(options.commandType, {
      path: options.commandType === "navigateToPath" ? options.targetOfficialPath : undefined,
      text: options.text,
      selector: options.selector,
      value: options.value
    });
    setLogState((state) => appendOverlayAction(state, {
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
          type: command.type,
          success: false,
          message: "Official webview did not respond before timeout",
          route: options.targetOfficialPath
        };
        setLogState((state) => appendOverlayAction(state, {
          page: options.page,
          action: options.action,
          targetOfficialPath: options.targetOfficialPath,
          status: "failure",
          message: result.message
        }));
        setToast(result.message);
        resolve(result);
      }, command.timeoutMs ?? 3500);
      pendingCommands.current.set(command.id, { page: options.page, action: options.action, targetOfficialPath: options.targetOfficialPath, resolve, timeout });
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
                    ? <OfficialDriverPanel mode={logState.webviewMode} setMode={changeWebviewMode} />
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
          <div><h1>{bridge.metadata.name}</h1><p>Control-first overlay for {bridge.metadata.targetDevice}</p></div>
          <div className="statusRow">
            <span className="pill good">{derived.connectedDeviceStatus}</span>
            <span className="pill">Official {derived.currentRoute}</span>
            <span className="pill">Last {derived.lastOverlayAction?.status ?? "idle"}</span>
            <label className="selectLabel">Official View<select value={logState.webviewMode} onChange={(event) => changeWebviewMode(event.target.value as WebviewMode)}>{(["Docked", "Compact", "Hidden"] as WebviewMode[]).map((mode) => <option key={mode}>{mode}</option>)}</select></label>
            <select value={theme} onChange={(event) => setThemePersisted(event.target.value)}>{themes.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
        </header>
        <main className="content">{content}</main>
      </section>
      <aside className="logDrawer"><UtilityDrawer derived={derived} actions={logState.actions} events={logState.events} exportLogs={exportLogs} /></aside>
      {toast && <div className="toast" onAnimationEnd={() => setToast(undefined)}>{toast}</div>}
      <OfficialWebviewHost ref={webviewRef} mode={logState.webviewMode} targetUrl={officialTargetUrl} addLogEvent={addLogEvent} updateOfficialUrl={updateOfficialUrl} />
    </div>
  );
}

const connectionText = ["Connect", "Wired connection", "Device", "AK680"];

function Dashboard(props: { api: OverlayApi; derived: ReturnType<typeof deriveLogState>; session: { active: boolean }; startSession: () => void; stopSession: () => void }) {
  return (
    <div className="stack pageFade">
      <section className="hero dashboardHero">
        <div><span className="eyebrow">Keyboard control</span><h2>Configure AK680 V2 through the official driver, from a cleaner overlay.</h2><p>The embedded AJAZZ driver still owns WebHID. This UI navigates and operates its visible controls where selectors are found.</p></div>
        <div className="heroActions"><button className="primary" onClick={() => props.api.runOverlayAction({ page: "Dashboard", action: "Connect AK680 V2", targetOfficialPath: officialPaths.keymap, commandType: "clickByText", text: "Connect" })}>Connect AK680 V2</button><button onClick={() => props.api.openOfficialPath(officialPaths.keymap, true)}>Open Official Connect</button></div>
      </section>
      <div className="grid three">
        <Metric title="AK680 V2 connection" value={props.derived.connectedDeviceStatus} note="Best available observed signal" />
        <Metric title="Official driver" value={props.derived.officialDriverStatus} note="Embedded webview remains mounted" />
        <Metric title="WebHID/device" value={props.derived.latestDeviceMetadata ? "Device selected" : "Permission may be needed"} note="VID 3141 / PID 32956 target" />
        <Metric title="Current official page" value={props.derived.currentRoute} note="Route-level adapter state" />
        <Metric title="Active profile" value="Default" note="Profile selection placeholder" />
        <Metric title="Last applied action" value={props.derived.lastOverlayAction?.message ?? "No overlay action yet"} note={props.derived.lastOverlayAction?.action ?? "Use a control page"} />
        <Metric title="Capture/log status" value={`${props.derived.eventCount} logs`} note={`${props.derived.markersCount} markers, logging secondary`} />
      </div>
      <div className="actions">
        <button onClick={() => props.api.openOfficialPath(officialPaths.lighting)}>Lighting</button>
        <button onClick={() => props.api.openOfficialPath(officialPaths.performance)}>Performance</button>
        <button onClick={() => props.api.openOfficialPath(officialPaths.keymap)}>Keymap</button>
        <button onClick={() => props.api.openOfficialPath(officialPaths.advancedKeys)}>Advanced Keys</button>
        <button onClick={() => props.api.openOfficialPath(officialPaths.macros)}>Macros</button>
        <button onClick={() => props.api.openOfficialPath(officialPaths.settings)}>Settings</button>
        <button onClick={props.session.active ? props.stopSession : props.startSession}>{props.session.active ? "Stop Capture" : "Start Capture"}</button>
      </div>
      <ActionTips items={connectionText} />
    </div>
  );
}

function LightingPage({ api, derived }: { api: OverlayApi; derived: ReturnType<typeof deriveLogState> }) {
  const [brightness, setBrightness] = useState(60);
  const [speed, setSpeed] = useState(50);
  const [mode, setMode] = useState("RGB");
  return (
    <div className="stack pageFade">
      <PageIntro title="Lighting" note="Effect and color controls use official DOM actions where matching controls are visible." path={officialPaths.lighting} api={api} />
      <div className="grid three"><Metric title="Official connection" value={derived.connectedDeviceStatus} note="Connect through official webview" /><Metric title="Official route" value={derived.currentRoute} note="/lighting expected" /><Metric title="Last lighting action" value={derived.lastOverlayAction?.message ?? "Idle"} note={derived.lastOverlayAction?.action ?? "Select an effect"} /></div>
      <div className="effectGrid">{lightingEffects.map((effect) => <button key={effect} className="effectCard" onClick={() => api.runOverlayAction({ page: "Lighting", action: `Lighting effect ${effect}`, targetOfficialPath: officialPaths.lighting, commandType: "clickByText", text: effect })}><strong>{effect}</strong><span>Apply through official control</span></button>)}</div>
      <div className="grid two">
        <ControlPanel title="Brightness" value={brightness} setValue={setBrightness} onApply={(value) => api.runOverlayAction({ page: "Lighting", action: `Brightness ${value}`, targetOfficialPath: officialPaths.lighting, commandType: "setRangeValue", text: "Brightness", value })} />
        <ControlPanel title="Speed" value={speed} setValue={setSpeed} onApply={(value) => api.runOverlayAction({ page: "Lighting", action: `Speed ${value}`, targetOfficialPath: officialPaths.lighting, commandType: "setRangeValue", text: "Speed", value })} />
      </div>
      <section className="panel"><span>Color mode</span><div className="segmented">{["RGB", "Monochrome"].map((item) => <button className={mode === item ? "active" : ""} key={item} onClick={() => { setMode(item); void api.runOverlayAction({ page: "Lighting", action: `Color mode ${item}`, targetOfficialPath: officialPaths.lighting, commandType: "clickByText", text: item }); }}>{item}</button>)}</div><div className="swatches">{colors.map((color) => <button key={color} style={{ background: color }} title={color} onClick={() => api.runOverlayAction({ page: "Lighting", action: `Color ${color}`, targetOfficialPath: officialPaths.lighting, commandType: "clickByText", text: color })} />)}</div></section>
    </div>
  );
}

function PerformancePage({ api, derived }: { api: OverlayApi; derived: ReturnType<typeof deriveLogState> }) {
  const [trigger, setTrigger] = useState(12);
  const [deadTop, setDeadTop] = useState(5);
  const [deadBottom, setDeadBottom] = useState(5);
  return (
    <div className="stack pageFade">
      <PageIntro title="Performance" note="Presets and tuning controls route through official performance UI when visible." path={officialPaths.performance} api={api} />
      <div className="grid three">{["Custom", "Office", "Beginner", "Game"].map((preset) => <button className="panel actionPanel" key={preset} onClick={() => api.runOverlayAction({ page: "Performance", action: `Preset ${preset}`, targetOfficialPath: officialPaths.performance, commandType: "clickByText", text: preset })}><span>Preset</span><strong>{preset}</strong><p>Apply via official driver</p></button>)}</div>
      <div className="tabs">{["Normal Mode", "Advanced Settings", "Recalibrate"].map((tab) => <button key={tab} onClick={() => api.runOverlayAction({ page: "Performance", action: `Open ${tab}`, targetOfficialPath: officialPaths.performance, commandType: "clickByText", text: tab })}>{tab}</button>)}</div>
      <div className="grid two">
        <ControlPanel title="Trigger Distance" value={trigger} setValue={setTrigger} onApply={(value) => api.runOverlayAction({ page: "Performance", action: `Trigger Distance ${value}`, targetOfficialPath: officialPaths.performance, commandType: "setRangeValue", text: "Trigger", value })} />
        <section className="panel"><span>Fast Trigger</span><strong>{derived.lastOverlayAction?.action === "Fast Trigger" ? "Requested" : "Ready"}</strong><button onClick={() => api.runOverlayAction({ page: "Performance", action: "Fast Trigger", targetOfficialPath: officialPaths.performance, commandType: "setToggleByLabel", text: "Fast Trigger" })}>Toggle in Official Driver</button></section>
        <ControlPanel title="Dead Zone Top" value={deadTop} setValue={setDeadTop} onApply={(value) => api.runOverlayAction({ page: "Performance", action: `Dead Zone Top ${value}`, targetOfficialPath: officialPaths.performance, commandType: "setRangeValue", text: "Dead Zone", value })} />
        <ControlPanel title="Dead Zone Bottom" value={deadBottom} setValue={setDeadBottom} onApply={(value) => api.runOverlayAction({ page: "Performance", action: `Dead Zone Bottom ${value}`, targetOfficialPath: officialPaths.performance, commandType: "setRangeValue", text: "Dead Zone", value })} />
      </div>
      <button className="primary" onClick={() => api.runOverlayAction({ page: "Performance", action: "Recalibrate", targetOfficialPath: officialPaths.performance, commandType: "clickByText", text: "Recalibrate" })}>Recalibrate in Official Driver</button>
    </div>
  );
}

function AdvancedKeysPage({ api }: { api: OverlayApi }) {
  return <RouteCards page="Advanced Keys" path={officialPaths.advancedKeys} api={api} cards={["RS / Snappy", "SOCD", "DKS", "MT", "TGL"]} />;
}

function SocdPage({ api }: { api: OverlayApi }) {
  return <div className="stack pageFade"><PageIntro title="SOCD" note="Conservative route-backed helper. No SOCD packet logic or automation." path={officialPaths.advancedKeys} api={api} /><div className="grid two"><button className="panel actionPanel" onClick={() => api.openOfficialPath(officialPaths.advancedKeys, true)}><span>Official route</span><strong>Open SOCD in Official Driver</strong><p>Use official page for final action.</p></button><button className="panel actionPanel" onClick={() => api.runOverlayAction({ page: "SOCD", action: "Find SOCD Panel", targetOfficialPath: officialPaths.advancedKeys, commandType: "clickByText", text: "SOCD" })}><span>Best-effort</span><strong>Find SOCD Panel</strong><p>Clicks visible SOCD text if found.</p></button></div></div>;
}

function KeymapPage({ api }: { api: OverlayApi }) {
  const [selected, setSelected] = useState("ESC");
  return <div className="stack pageFade"><PageIntro title="Keymap" note="Route-backed keyboard preview. Key-specific selectors are placeholders until official positions are mapped." path={officialPaths.keymap} api={api} /><div className="keyboardCard"><div className="keys">{Array.from({ length: 68 }, (_, index) => <button key={index} className={selected === keyLabel(index) ? "active" : ""} onClick={() => setSelected(keyLabel(index))}>{keyLabel(index)}</button>)}</div><div className="inspector">Selected {selected}. <button onClick={() => api.runOverlayAction({ page: "Keymap", action: `Open selected key ${selected}`, targetOfficialPath: officialPaths.keymap, commandType: "clickByText", text: selected })}>Open selected key in Official Driver</button></div></div></div>;
}

function MacrosPage({ api }: { api: OverlayApi }) {
  return <div className="stack pageFade"><PageIntro title="Macros" note="Macro actions use visible official text where found. Recording falls back safely if not found." path={officialPaths.macros} api={api} /><div className="grid three">{["Open Macro Manager", "New Macro in Official Driver", "Start Recording in Official Driver"].map((action) => <button className="panel actionPanel" key={action} onClick={() => api.runOverlayAction({ page: "Macros", action, targetOfficialPath: officialPaths.macros, commandType: "clickByText", text: action.replace(" in Official Driver", "").replace("Open ", "").replace("Start ", "") })}><span>Macro</span><strong>{action}</strong><p>Best-effort official DOM action</p></button>)}</div></div>;
}

function SettingsPage(props: { theme: string; setTheme: (theme: string) => void; api: OverlayApi; exportLogs: () => void; clearLogs: () => void }) {
  return <div className="stack pageFade"><PageIntro title="Settings" note="App preferences and safe official settings shortcuts." path={officialPaths.settings} api={props.api} /><div className="grid two"><section className="panel"><span>Theme</span><select value={props.theme} onChange={(event) => props.setTheme(event.target.value)}>{themes.map((item) => <option key={item}>{item}</option>)}</select></section>{["Stability Mode", "Adaptive Dynamic Calibration", "Return Rate"].map((text) => <button className="panel actionPanel" key={text} onClick={() => props.api.runOverlayAction({ page: "Settings", action: text, targetOfficialPath: officialPaths.settings, commandType: "clickByText", text })}><span>Official shortcut</span><strong>{text}</strong><p>Open/click if visible</p></button>)}<section className="panel"><span>Destructive setting</span><strong>Reset all keyboard settings</strong><p>Never triggered automatically. Opens official settings only.</p><button onClick={() => props.api.openOfficialPath(officialPaths.settings, true)}>Open in Official Driver</button></section><section className="panel"><span>Logs</span><strong>Export or clear</strong><div className="actions"><button onClick={props.exportLogs}>Export Logs</button><button onClick={props.clearLogs}>Clear Logs</button></div></section></div></div>;
}

function RouteCards({ page, path, api, cards }: { page: Page; path: OfficialPath; api: OverlayApi; cards: string[] }) {
  return <div className="stack pageFade"><PageIntro title={page} note="Route-backed controls. Cards click matching visible official text when possible." path={path} api={api} /><div className="grid three">{cards.map((card) => <button className="panel actionPanel" key={card} onClick={() => api.runOverlayAction({ page, action: `Open ${card}`, targetOfficialPath: path, commandType: "clickByText", text: card })}><span>Official card</span><strong>{card}</strong><p>Best-effort DOM adapter</p></button>)}</div></div>;
}

function PageIntro({ title, note, path, api }: { title: string; note: string; path: OfficialPath; api: OverlayApi }) {
  return <section className="pageIntro"><div><span className="eyebrow">Overlay control</span><h2>{title}</h2><p>{note}</p></div><div className="heroActions"><button className="primary" onClick={() => api.runOverlayAction({ page: title as Page, action: `Open ${path}`, targetOfficialPath: path, commandType: "navigateToPath" })}>Prepare Official Page</button><button onClick={() => api.openOfficialPath(path, true)}>Show Official Driver</button></div></section>;
}

function OfficialDriverPanel({ mode, setMode }: { mode: WebviewMode; setMode: (mode: WebviewMode) => void }) {
  return <div className="stack pageFade"><div className="notice">The official webview remains mounted. Docked shows it full-size, Compact shows an inspector, Hidden de-emphasizes it while overlay pages control it.</div><div className="actions">{(["Docked", "Compact", "Hidden"] as WebviewMode[]).map((item) => <button className={mode === item ? "primary" : ""} key={item} onClick={() => setMode(item)}>{item}</button>)}</div></div>;
}

const OfficialWebviewHost = React.forwardRef<ElectronWebview | null, { mode: WebviewMode; targetUrl: string; addLogEvent: (payload: unknown) => void; updateOfficialUrl: (url: string, type?: string) => void }>(function OfficialWebviewHost(props, ref) {
  const localRef = useRef<ElectronWebview | null>(null);
  useEffect(() => {
    if (typeof ref === "function") ref(localRef.current);
    else if (ref) ref.current = localRef.current;
  });
  useEffect(() => {
    const webview = localRef.current;
    if (!webview) return;
    const ipc = (event: Event) => {
      const detail = event as Event & { channel?: string; args?: unknown[] };
      if (detail.channel === "ak680-log-event") props.addLogEvent(detail.args?.[0]);
    };
    const nav = (event: Event) => props.updateOfficialUrl((event.currentTarget as ElectronWebview).getURL?.() ?? bridge.metadata.officialDriverUrl, event.type);
    webview.addEventListener("ipc-message", ipc);
    webview.addEventListener("did-navigate", nav);
    webview.addEventListener("did-navigate-in-page", nav);
    webview.addEventListener("page-title-updated", nav);
    return () => {
      webview.removeEventListener("ipc-message", ipc);
      webview.removeEventListener("did-navigate", nav);
      webview.removeEventListener("did-navigate-in-page", nav);
      webview.removeEventListener("page-title-updated", nav);
    };
  }, [props]);
  useEffect(() => {
    const webview = localRef.current;
    if (webview?.loadURL && webview.getURL?.() !== props.targetUrl) void webview.loadURL(props.targetUrl);
  }, [props.targetUrl]);
  return <div className={`officialHost ${props.mode.toLowerCase()}`}><webview ref={(node) => { localRef.current = node as ElectronWebview | null; }} src={props.targetUrl} preload={bridge.metadata.webviewPreloadPath} allow="hid" partition="persist:ajazz-official" /></div>;
});

function LogsPage(props: { events: OverlayLogEvent[]; actions: OverlayAction[]; marker: string; setMarker: (marker: string) => void; addMarker: (label?: string) => void; exportLogs: () => void; clearLogs: () => void; derived: ReturnType<typeof deriveLogState> }) {
  const [filter, setFilter] = useState<Filter>("All");
  const events = filterEvents(props.events, filter);
  return <div className="logs full pageFade"><div className="logsHeader"><div><h2>Logs & Actions</h2><p>{props.derived.eventCount} raw events and {props.actions.length} overlay actions.</p></div><div className="actions"><button onClick={props.exportLogs}>Export JSON</button><button onClick={props.clearLogs}>Clear Logs</button></div></div><FilterTabs filter={filter} setFilter={setFilter} /><QuickMarkers addMarker={(label) => props.addMarker(label)} /><MarkerInput marker={props.marker} setMarker={props.setMarker} addMarker={props.addMarker} /><ActionHistory actions={props.actions} /><EventList events={events} /></div>;
}

function UtilityDrawer({ derived, actions, events, exportLogs }: { derived: ReturnType<typeof deriveLogState>; actions: OverlayAction[]; events: OverlayLogEvent[]; exportLogs: () => void }) {
  return <div className="logs"><div className="drawerTitle"><h3>Utility</h3><span className="sessionDot">Secondary</span></div><div className="miniStats"><span>{derived.connectedDeviceStatus}</span><span>Route {derived.currentRoute}</span><span>Last {derived.lastOverlayAction?.status ?? "none"}</span><span>{events.length} log events</span></div><ActionHistory actions={actions.slice(0, 5)} compact /><button onClick={exportLogs}>Export JSON</button></div>;
}

function ActionHistory({ actions, compact = false }: { actions: OverlayAction[]; compact?: boolean }) {
  return <div className="actionHistory">{actions.length === 0 && <div className="empty">No overlay actions yet.</div>}{actions.map((action) => <div className={`actionRow ${action.status}`} key={action.id}><time>{new Date(action.timestamp).toLocaleTimeString()}</time><strong>{action.action}</strong>{!compact && <span>{action.page} · {action.targetOfficialPath}</span>}<p>{action.message}</p></div>)}</div>;
}

function ControlPanel({ title, value, setValue, onApply }: { title: string; value: number; setValue: (value: number) => void; onApply: (value: number) => void }) {
  return <section className="control"><label>{title}</label><input type="range" min="0" max="100" value={value} onChange={(event) => setValue(Number(event.target.value))} /><button onClick={() => onApply(value)}>Apply {value}</button></section>;
}

function ActionTips({ items }: { items: string[] }) {
  return <div className="notice">Connection flow is best-effort: the adapter looks for visible official text such as {items.join(", ")}. Browser permission prompts still require user approval.</div>;
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

createRoot(document.getElementById("root")!).render(<App />);
