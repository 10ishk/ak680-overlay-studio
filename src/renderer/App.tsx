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
  deriveLogState,
  exportLogJson,
  initialLogState,
  normalizeGuestEvent,
  OverlayLogEvent,
  timestampFilename
} from "./logStore";
import "./styles.css";

type Page =
  | "Dashboard"
  | "Lighting"
  | "Performance"
  | "Advanced Keys"
  | "SOCD"
  | "Keymap"
  | "Macros"
  | "Official Driver"
  | "Logs"
  | "Settings";

type Filter = "All" | "HID" | "DOM" | "Markers" | "Errors";

type ElectronWebview = HTMLElement & {
  getURL?: () => string;
  reload?: () => void;
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
const markerExamples = ["SOCD baseline", "SOCD ON", "SOCD OFF", "RT 1.2mm", "Lighting Snowfall", "Macro Save"];

function App() {
  const [page, setPage] = useState<Page>("Dashboard");
  const [theme, setTheme] = useState(themes[0]);
  const [logState, setLogState] = useState(initialLogState);
  const [marker, setMarker] = useState(markerExamples[0]);
  const derived = useMemo(() => deriveLogState(logState), [logState]);

  const addLogEvent = useCallback((payload: unknown) => {
    setLogState((state) => appendEvent(state, normalizeGuestEvent(payload, state.officialUrl)));
  }, []);

  useEffect(() => {
    return bridge.host?.onPermissionEvent((payload) => {
      addLogEvent({
        source: "host",
        type: "permission",
        phase: "event",
        summary: "Host WebHID permission event",
        ...asRecord(payload)
      });
    });
  }, [addLogEvent]);

  const addMarker = useCallback((label = marker) => {
    setLogState((state) => appendMarker(state, label));
  }, [marker]);

  const clearLogs = useCallback(() => {
    setLogState((state) => ({ ...state, events: [] }));
  }, []);

  const exportLogs = useCallback(() => {
    const payload = exportLogJson(logState);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = timestampFilename();
    link.click();
    URL.revokeObjectURL(url);
  }, [logState]);

  const updateOfficialUrl = useCallback((url: string, type = "navigation") => {
    setLogState((state) => appendEvent({ ...state, officialUrl: url }, normalizeGuestEvent({ source: "host", type, phase: "event", url, summary: `Official webview ${type}` }, url)));
  }, []);

  const content = useMemo(() => {
    if (page === "Dashboard") {
      return <Dashboard setPage={setPage} addMarker={addMarker} exportLogs={exportLogs} clearLogs={clearLogs} derived={derived} />;
    }
    if (page === "Official Driver") {
      return <OfficialDriver addLogEvent={addLogEvent} updateOfficialUrl={updateOfficialUrl} />;
    }
    if (page === "Logs") {
      return (
        <LogsPage
          events={logState.events}
          marker={marker}
          setMarker={setMarker}
          addMarker={addMarker}
          exportLogs={exportLogs}
          clearLogs={clearLogs}
          derived={derived}
        />
      );
    }
    if (page === "Settings") {
      return <SettingsPage theme={theme} setTheme={setTheme} exportLogs={exportLogs} clearLogs={clearLogs} />;
    }
    return <FeaturePage page={page} setPage={setPage} />;
  }, [page, addMarker, exportLogs, clearLogs, derived, addLogEvent, updateOfficialUrl, logState.events, marker, theme]);

  return (
    <div className="app" data-theme={theme.toLowerCase().replaceAll(" ", "-")}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark"><Zap size={18} /></div>
          <div>
            <strong>AK680</strong>
            <span>Overlay Studio</span>
          </div>
        </div>
        <nav>
          {pages.map((item) => {
            const Icon = item.icon;
            return (
              <button className={page === item.name ? "active" : ""} key={item.name} onClick={() => setPage(item.name)}>
                <Icon size={18} />
                {item.name}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{bridge.metadata.name}</h1>
            <p>Official driver wrapper for {bridge.metadata.targetDevice}</p>
          </div>
          <div className="statusRow">
            <span className="pill good">{derived.connectedDeviceStatus}</span>
            <span className="pill">Route {derived.currentRoute}</span>
            <span className="pill">{derived.eventCount} events</span>
            <select value={theme} onChange={(event) => setTheme(event.target.value)}>
              {themes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </header>
        <main className="content">{content}</main>
      </section>

      <aside className="logDrawer">
        <LiveLogs
          events={logState.events}
          marker={marker}
          setMarker={setMarker}
          addMarker={addMarker}
          exportLogs={exportLogs}
          clearLogs={clearLogs}
          derived={derived}
        />
      </aside>
    </div>
  );
}

function Dashboard(props: {
  setPage: (page: Page) => void;
  addMarker: () => void;
  exportLogs: () => void;
  clearLogs: () => void;
  derived: ReturnType<typeof deriveLogState>;
}) {
  return (
    <div className="stack">
      <section className="hero">
        <div>
          <span className="eyebrow">Overlay logger active</span>
          <h2>AK680 V2 control stays inside the official webview.</h2>
          <p>This shell observes WebHID and page activity, labels sessions, and exports logs without native HID writes or packet sending.</p>
        </div>
        <button className="primary" onClick={() => props.setPage("Official Driver")}>Open Official Driver</button>
      </section>
      <div className="grid three">
        <Metric title="Official Driver status" value="Ready" note="Visible webview with guest preload logger" />
        <Metric title="WebHID permission" value="AJAZZ origin only" note="https://ajazz.driveall.cn/" />
        <Metric title="Logging status" value={`${props.derived.eventCount} events`} note={`${props.derived.markersCount} manual markers`} />
        <Metric title="Last action" value={props.derived.lastAction} note="Latest event summary" />
        <Metric title="Last TX packet" value={props.derived.lastTxPacket} note="Observed sendReport/sendFeatureReport only" />
        <Metric title="Last RX packet" value={props.derived.lastRxPacket} note="Observed inputreport/feature receive only" />
      </div>
      <div className="actions">
        <button onClick={() => props.setPage("Official Driver")}>Open Official Driver</button>
        <button onClick={props.addMarker}>Add Marker</button>
        <button onClick={props.exportLogs}>Export Logs</button>
        <button onClick={props.clearLogs}>Clear Logs</button>
      </div>
    </div>
  );
}

function OfficialDriver(props: { addLogEvent: (payload: unknown) => void; updateOfficialUrl: (url: string, type?: string) => void }) {
  const webviewRef = useRef<ElectronWebview | null>(null);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;
    const handleIpcMessage = (event: Event) => {
      const detail = event as Event & { channel?: string; args?: unknown[] };
      if (detail.channel === "ak680-log-event") props.addLogEvent(detail.args?.[0]);
    };
    const handleNavigate = (event: Event) => props.updateOfficialUrl((event.currentTarget as ElectronWebview).getURL?.() ?? bridge.metadata.officialDriverUrl, event.type);

    webview.addEventListener("ipc-message", handleIpcMessage);
    webview.addEventListener("did-navigate", handleNavigate);
    webview.addEventListener("did-navigate-in-page", handleNavigate);
    webview.addEventListener("page-title-updated", handleNavigate);
    return () => {
      webview.removeEventListener("ipc-message", handleIpcMessage);
      webview.removeEventListener("did-navigate", handleNavigate);
      webview.removeEventListener("did-navigate-in-page", handleNavigate);
      webview.removeEventListener("page-title-updated", handleNavigate);
    };
  }, [props]);

  return (
    <div className="stack">
      <div className="notice">The official webview performs real keyboard communication. AK680 Overlay Studio observes and logs only.</div>
      <div className="webviewFrame">
        <webview
          ref={(node) => { webviewRef.current = node as ElectronWebview | null; }}
          src={bridge.metadata.officialDriverUrl}
          preload={bridge.metadata.webviewPreloadPath}
          allow="hid"
          partition="persist:ajazz-official"
        />
      </div>
    </div>
  );
}

function FeaturePage({ page, setPage }: { page: Page; setPage: (page: Page) => void }) {
  const lighting = page === "Lighting";
  const performance = page === "Performance";
  const advanced = page === "Advanced Keys" || page === "SOCD";
  return (
    <div className="stack">
      <section className="pageIntro">
        <div>
          <span className="eyebrow">Planned workspace</span>
          <h2>{page}</h2>
          <p>Prototype-only layout. Real keyboard writes are intentionally unavailable in MVP-1.</p>
        </div>
        <button className="primary" onClick={() => setPage("Official Driver")}>Use Official Driver</button>
      </section>
      {lighting && <CardGrid items={["Aurora", "Snowfall", "Reactive Ripple", "Waveform", "Breathing", "Static Palette"]} suffix="effect preview" />}
      {performance && <CardGrid items={["Office", "Beginner", "Game", "Custom"]} suffix="preset draft" />}
      {advanced && <CardGrid items={["RS / Snappy", "SOCD", "DKS", "MT", "TGL"]} suffix="setup flow disabled" />}
      {page === "Keymap" && <KeyboardPreview />}
      {page === "Macros" && <CardGrid items={["Macro list", "Recording", "Action timeline", "Profile export"]} suffix="disabled" />}
      <div className="grid two">
        <DisabledControl title="Brightness / speed" />
        <DisabledControl title="Trigger Distance" />
        <DisabledControl title="Fast Trigger" />
        <DisabledControl title="Dead Zone" />
        <DisabledControl title="Calibration" />
        <DisabledControl title="Color palette" />
      </div>
      <div className="notice">Coming later. Use Official Driver for real writes. No native writes in this prototype.</div>
    </div>
  );
}

function KeyboardPreview() {
  return (
    <div className="keyboardCard">
      <div className="tabs"><button disabled>Layer 0</button><button disabled>Layer 1</button><button disabled>Fn</button></div>
      <div className="keys">{Array.from({ length: 68 }, (_, index) => <span key={index}>{index % 12 === 0 ? "ESC" : ""}</span>)}</div>
      <div className="inspector">Key inspector placeholder. No writes.</div>
    </div>
  );
}

function CardGrid({ items, suffix }: { items: string[]; suffix: string }) {
  return <div className="grid three">{items.map((item) => <Metric key={item} title={item} value="TODO" note={suffix} />)}</div>;
}

function DisabledControl({ title }: { title: string }) {
  return <div className="control"><label>{title}</label><input disabled type="range" /><button disabled>Apply</button></div>;
}

function SettingsPage(props: { theme: string; setTheme: (theme: string) => void; exportLogs: () => void; clearLogs: () => void }) {
  return (
    <div className="stack">
      <section className="pageIntro"><h2>Settings</h2><p>Local shell preferences and logging controls for the prototype.</p></section>
      <div className="grid two">
        <div className="panel"><label>Theme</label><select value={props.theme} onChange={(event) => props.setTheme(event.target.value)}>{themes.map((item) => <option key={item}>{item}</option>)}</select></div>
        <Metric title="Logging settings" value="Live observer" note="WebHID, DOM activity, and manual markers" />
        <Metric title="Safety notes" value="No reset button" note="No native HID writes or packet sender" />
        <div className="actions"><button onClick={props.exportLogs}>Export Logs</button><button onClick={props.clearLogs}>Clear Logs</button></div>
      </div>
    </div>
  );
}

function LiveLogs(props: {
  events: OverlayLogEvent[];
  marker: string;
  setMarker: (marker: string) => void;
  addMarker: () => void;
  exportLogs: () => void;
  clearLogs: () => void;
  derived: ReturnType<typeof deriveLogState>;
}) {
  const [filter, setFilter] = useState<Filter>("All");
  const events = filterEvents(props.events, filter).slice(0, 20);
  return (
    <div className="logs">
      <h3>Live Logs</h3>
      <div className="miniStats">
        <span>{props.derived.eventCount} events</span>
        <span>Route {props.derived.currentRoute}</span>
        <span>TX {props.derived.lastTxPacket}</span>
        <span>RX {props.derived.lastRxPacket}</span>
        <span>{props.derived.connectedDeviceStatus}</span>
      </div>
      <FilterTabs filter={filter} setFilter={setFilter} />
      <MarkerInput marker={props.marker} setMarker={props.setMarker} addMarker={props.addMarker} />
      <div className="actions compact">
        <button onClick={props.exportLogs}>Export JSON</button>
        <button onClick={props.clearLogs}>Clear Log</button>
      </div>
      <EventList events={events} compact />
    </div>
  );
}

function LogsPage(props: {
  events: OverlayLogEvent[];
  marker: string;
  setMarker: (marker: string) => void;
  addMarker: () => void;
  exportLogs: () => void;
  clearLogs: () => void;
  derived: ReturnType<typeof deriveLogState>;
}) {
  const [filter, setFilter] = useState<Filter>("All");
  const events = filterEvents(props.events, filter);
  return (
    <div className="logs full">
      <div className="logsHeader">
        <div>
          <h2>Logs</h2>
          <p>{props.derived.eventCount} events captured from the official webview session.</p>
        </div>
        <div className="actions">
          <button onClick={props.exportLogs}>Export JSON</button>
          <button onClick={props.clearLogs}>Clear Logs</button>
        </div>
      </div>
      <div className="miniStats wide">
        <span>Route {props.derived.currentRoute}</span>
        <span>Last action {props.derived.lastAction}</span>
        <span>TX {props.derived.lastTxPacket}</span>
        <span>RX {props.derived.lastRxPacket}</span>
      </div>
      <FilterTabs filter={filter} setFilter={setFilter} />
      <MarkerInput marker={props.marker} setMarker={props.setMarker} addMarker={props.addMarker} />
      <EventList events={events} />
    </div>
  );
}

function MarkerInput(props: { marker: string; setMarker: (marker: string) => void; addMarker: () => void }) {
  return (
    <div className="markerInput">
      <input list="markers" value={props.marker} onChange={(event) => props.setMarker(event.target.value)} />
      <datalist id="markers">{markerExamples.map((item) => <option key={item} value={item} />)}</datalist>
      <button onClick={props.addMarker}>Add Marker</button>
    </div>
  );
}

function FilterTabs(props: { filter: Filter; setFilter: (filter: Filter) => void }) {
  const filters: Filter[] = ["All", "HID", "DOM", "Markers", "Errors"];
  return (
    <div className="filterTabs">
      {filters.map((filter) => <button key={filter} className={props.filter === filter ? "active" : ""} onClick={() => props.setFilter(filter)}>{filter}</button>)}
    </div>
  );
}

function EventList({ events, compact = false }: { events: OverlayLogEvent[]; compact?: boolean }) {
  return (
    <div className={compact ? "eventList compactList" : "eventTable"}>
      {events.length === 0 && <div className="empty">No matching log events yet.</div>}
      {events.map((event) => (
        <div className="event" key={event.id}>
          <time>{new Date(event.timestamp).toLocaleTimeString()}</time>
          <span className={`source ${event.source}`}>{event.source}</span>
          <strong>{event.summary}</strong>
          {!compact && <span>{event.reportId !== undefined ? `r${event.reportId}` : "-"}</span>}
          {!compact && <span>{event.length !== undefined ? `${event.length} bytes` : "-"}</span>}
          {!compact && <code>{event.hex ? event.hex.split(" ").slice(0, 16).join(" ") : event.markerLabel ?? event.text ?? "-"}</code>}
        </div>
      ))}
    </div>
  );
}

function filterEvents(events: OverlayLogEvent[], filter: Filter): OverlayLogEvent[] {
  if (filter === "HID") return events.filter((event) => event.source === "webhid");
  if (filter === "DOM") return events.filter((event) => event.source === "dom");
  if (filter === "Markers") return events.filter((event) => event.source === "marker");
  if (filter === "Errors") return events.filter((event) => event.phase === "error" || Boolean(event.error));
  return events;
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return <article className="panel"><span>{title}</span><strong>{value}</strong><p>{note}</p></article>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

createRoot(document.getElementById("root")!).render(<App />);
