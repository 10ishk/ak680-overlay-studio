import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Brush,
  Cpu,
  Gauge,
  Keyboard,
  Layers,
  ListTodo,
  MonitorUp,
  Settings,
  Shield,
  SlidersHorizontal,
  TerminalSquare,
  Zap
} from "lucide-react";
import { getBridge } from "../bridge/ak680Bridge";
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

type LogEvent = {
  id: string;
  type: string;
  label: string;
  createdAt: string;
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
  const [events, setEvents] = useState<LogEvent[]>([
    { id: "boot", type: "system", label: "Overlay shell ready", createdAt: new Date().toISOString() }
  ]);
  const [marker, setMarker] = useState(markerExamples[0]);
  const currentRoute = page === "Official Driver" ? "/" : "overlay/" + page.toLowerCase().replaceAll(" ", "-");
  const lastAction = events[0]?.label ?? "Idle";

  function addMarker(label = marker) {
    const next = bridge.logger.addMarker(label);
    setEvents((items) => [next, ...items]);
  }

  function clearLogs() {
    setEvents([]);
  }

  function exportLogs() {
    const payload = bridge.logger.exportPlaceholder(events);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ak680-overlay-logs-placeholder.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  const content = useMemo(() => {
    if (page === "Dashboard") {
      return <Dashboard setPage={setPage} addMarker={addMarker} exportLogs={exportLogs} clearLogs={clearLogs} lastAction={lastAction} />;
    }
    if (page === "Official Driver") {
      return <OfficialDriver />;
    }
    if (page === "Logs") {
      return (
        <LogsPanel
          events={events}
          marker={marker}
          setMarker={setMarker}
          addMarker={addMarker}
          exportLogs={exportLogs}
          clearLogs={clearLogs}
          full
        />
      );
    }
    if (page === "Settings") {
      return <SettingsPage theme={theme} setTheme={setTheme} exportLogs={exportLogs} clearLogs={clearLogs} />;
    }
    return <FeaturePage page={page} setPage={setPage} />;
  }, [page, events, marker, theme, lastAction]);

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
            <span className="pill good">AK680 V2 target</span>
            <span className="pill">Route {currentRoute}</span>
            <span className="pill">{events.length} events</span>
            <select value={theme} onChange={(event) => setTheme(event.target.value)}>
              {themes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </header>
        <main className="content">{content}</main>
      </section>

      <aside className="logDrawer">
        <LogsPanel
          events={events}
          marker={marker}
          setMarker={setMarker}
          addMarker={addMarker}
          exportLogs={exportLogs}
          clearLogs={clearLogs}
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
  lastAction: string;
}) {
  return (
    <div className="stack">
      <section className="hero">
        <div>
          <span className="eyebrow">Overlay prototype</span>
          <h2>AK680 V2 control stays inside the official webview.</h2>
          <p>This shell observes, labels, and prepares future route adapters without native HID writes or packet sending.</p>
        </div>
        <button className="primary" onClick={() => props.setPage("Official Driver")}>Open Official Driver</button>
      </section>
      <div className="grid three">
        <Metric title="Official Driver status" value="Ready" note="Visible webview available" />
        <Metric title="WebHID permission" value="AJAZZ origin only" note="VID 3141 / PID 32956 target" />
        <Metric title="Logging status" value="Placeholder" note="Manual markers enabled" />
        <Metric title="Last action" value={props.lastAction} note="Local event state" />
        <Metric title="Last TX packet" value="none" note="No packet sender in MVP" />
        <Metric title="Last RX packet" value="none" note="Real interception comes later" />
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

function OfficialDriver() {
  return (
    <div className="stack">
      <div className="notice">The official webview performs real keyboard communication. AK680 Overlay Studio observes and logs only.</div>
      <div className="webviewFrame">
        <webview src={bridge.metadata.officialDriverUrl} allow="hid" partition="persist:ajazz-official" />
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
        <Metric title="Logging settings" value="Placeholder" note="Manual markers only" />
        <Metric title="Safety notes" value="No reset button" note="No native HID writes or packet sender" />
        <div className="actions"><button onClick={props.exportLogs}>Export Logs</button><button onClick={props.clearLogs}>Clear Logs</button></div>
      </div>
    </div>
  );
}

function LogsPanel(props: {
  events: LogEvent[];
  marker: string;
  setMarker: (marker: string) => void;
  addMarker: () => void;
  exportLogs: () => void;
  clearLogs: () => void;
  full?: boolean;
}) {
  return (
    <div className={props.full ? "logs full" : "logs"}>
      <h3>Live Logs</h3>
      <div className="miniStats">
        <span>{props.events.length} events</span>
        <span>Route /</span>
        <span>TX none</span>
        <span>RX none</span>
        <span>Device target ready</span>
      </div>
      <input list="markers" value={props.marker} onChange={(event) => props.setMarker(event.target.value)} />
      <datalist id="markers">{markerExamples.map((item) => <option key={item} value={item} />)}</datalist>
      <div className="actions compact">
        <button onClick={props.addMarker}>Add Marker</button>
        <button onClick={props.exportLogs}>Export JSON</button>
        <button onClick={props.clearLogs}>Clear Log</button>
      </div>
      <div className="eventList">
        {props.events.length === 0 && <div className="empty">No log events yet.</div>}
        {props.events.map((event) => (
          <div className="event" key={event.id}>
            <span>{event.type}</span>
            <strong>{event.label}</strong>
            <time>{new Date(event.createdAt).toLocaleTimeString()}</time>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return <article className="panel"><span>{title}</span><strong>{value}</strong><p>{note}</p></article>;
}

createRoot(document.getElementById("root")!).render(<App />);
