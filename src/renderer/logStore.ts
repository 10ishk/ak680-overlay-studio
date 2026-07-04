import { getBridge } from "../bridge/ak680Bridge";

export type LogSource = "webhid" | "dom" | "marker" | "host" | "system";
export type LogPhase = "before" | "after" | "error" | "input" | "event";

export type DeviceMetadata = {
  productName?: string;
  vendorId?: number;
  productId?: number;
  opened?: boolean;
  collections?: unknown;
  usagePage?: number;
  usage?: number;
};

export type OverlayLogEvent = DeviceMetadata & {
  id: string;
  timestamp: string;
  source: LogSource;
  type: string;
  method?: string;
  phase?: LogPhase;
  route?: string;
  url?: string;
  summary: string;
  reportId?: number;
  length?: number;
  hex?: string;
  bytes?: number[];
  error?: string;
  markerLabel?: string;
  tag?: string;
  role?: string | null;
  text?: string;
  classSummary?: string;
  value?: string | number | boolean;
};

export type LogState = {
  events: OverlayLogEvent[];
  officialUrl: string;
  session: CaptureSession;
  actions: OverlayAction[];
  webviewMode: WebviewMode;
};

export type CaptureSession = {
  active: boolean;
  startedAt?: string;
  endedAt?: string;
};

export type WebviewMode = "Docked" | "Compact" | "Hidden";

export type OverlayActionStatus = "pending" | "success" | "failure";

export type OverlayAction = {
  id: string;
  timestamp: string;
  page: string;
  action: string;
  targetOfficialPath: string;
  status: OverlayActionStatus;
  message: string;
  matchedText?: string;
  selector?: string;
  details?: unknown;
};

export type LogDerivedState = {
  eventCount: number;
  markersCount: number;
  currentRoute: string;
  lastAction: string;
  lastTxPacket: string;
  lastRxPacket: string;
  connectedDeviceStatus: string;
  officialDriverStatus: string;
  latestDeviceMetadata?: DeviceMetadata;
  lastOverlayAction?: OverlayAction;
  deviceConnectStatus: string;
};

const bridge = getBridge();

export const initialLogState: LogState = {
  officialUrl: bridge.metadata.officialDriverUrl,
  session: { active: false },
  actions: [],
  webviewMode: "Hidden",
  events: [
    {
      id: "boot",
      timestamp: new Date().toISOString(),
      source: "system",
      type: "boot",
      phase: "event",
      summary: "Overlay shell ready",
      route: routeFromUrl(bridge.metadata.officialDriverUrl),
      url: bridge.metadata.officialDriverUrl
    }
  ]
};

export function normalizeGuestEvent(payload: unknown, officialUrl: string): OverlayLogEvent {
  const data = isRecord(payload) ? payload : {};
  const timestamp = stringValue(data.timestamp) ?? new Date().toISOString();
  const source = sourceValue(data.source);
  const method = stringValue(data.method);
  const phase = phaseValue(data.phase);
  const type = stringValue(data.type) ?? method ?? "event";
  const url = stringValue(data.url) ?? officialUrl;
  const route = stringValue(data.route) ?? routeFromUrl(url);
  const reportId = numberValue(data.reportId);
  const length = numberValue(data.length);
  const hex = stringValue(data.hex);
  const markerLabel = stringValue(data.markerLabel);
  const error = stringValue(data.error);
  const summary = stringValue(data.summary) ?? buildSummary(source, type, method, phase, reportId, length, hex, markerLabel, error);

  return {
    id: stringValue(data.id) ?? crypto.randomUUID(),
    timestamp,
    source,
    type,
    method,
    phase,
    route,
    url,
    summary,
    reportId,
    length,
    hex,
    bytes: numberArray(data.bytes),
    error,
    markerLabel,
    productName: stringValue(data.productName),
    vendorId: numberValue(data.vendorId),
    productId: numberValue(data.productId),
    opened: booleanValue(data.opened),
    collections: data.collections,
    usagePage: numberValue(data.usagePage),
    usage: numberValue(data.usage),
    tag: stringValue(data.tag),
    role: stringValue(data.role),
    text: stringValue(data.text),
    classSummary: stringValue(data.classSummary),
    value: primitiveValue(data.value)
  };
}

export function appendEvent(state: LogState, event: OverlayLogEvent): LogState {
  const officialUrl = officialUrlForState(state.officialUrl, event.url);
  if (hasRecentDuplicateDiagnostic(state.events, event)) {
    return {
      ...state,
      officialUrl
    };
  }
  return {
    officialUrl,
    session: state.session,
    actions: state.actions,
    webviewMode: state.webviewMode,
    events: [event, ...state.events]
  };
}

export function appendMarker(state: LogState, label: string): LogState {
  const cleanLabel = label.trim() || "Manual marker";
  return appendEvent(state, {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source: "marker",
    type: "marker",
    phase: "event",
    markerLabel: cleanLabel,
    summary: cleanLabel,
    route: routeFromUrl(state.officialUrl),
    url: state.officialUrl
  });
}

export function startCaptureSession(state: LogState): LogState {
  const startedAt = new Date().toISOString();
  return appendMarker({ ...state, session: { active: true, startedAt, endedAt: undefined } }, "Session started");
}

export function stopCaptureSession(state: LogState): LogState {
  const endedAt = new Date().toISOString();
  return appendMarker({ ...state, session: { ...state.session, active: false, endedAt } }, "Session stopped");
}

export function deriveLogState(state: LogState): LogDerivedState {
  const latestDeviceMetadata = state.events.find((event) => event.vendorId || event.productId || event.productName);
  const lastTx = state.events.find((event) => event.source === "webhid" && event.phase === "before" && event.method?.toLowerCase().includes("send"));
  const lastRx = state.events.find((event) => event.source === "webhid" && (event.phase === "input" || event.method === "receiveFeatureReport"));
  const connected = state.events.find((event) => event.source === "webhid" && event.method === "HIDDevice.open" && event.phase === "after");
  const closed = state.events.find((event) => event.source === "webhid" && event.method === "HIDDevice.close" && event.phase === "after");

  return {
    eventCount: state.events.length,
    markersCount: state.events.filter((event) => event.source === "marker").length,
    currentRoute: routeFromUrl(state.officialUrl),
    lastAction: state.events[0]?.summary ?? "Idle",
    lastTxPacket: packetSummary(lastTx),
    lastRxPacket: packetSummary(lastRx),
    connectedDeviceStatus: connected && (!closed || connected.timestamp > closed.timestamp) ? "Device opened by official webview" : "Waiting for official WebHID session",
    officialDriverStatus: state.events.some((event) => event.source === "dom" || event.type.includes("navigate") || event.type.includes("route")) ? "Official loaded" : "Loading official driver",
    latestDeviceMetadata,
    lastOverlayAction: state.actions[0],
    deviceConnectStatus: deviceConnectStatus(state.events)
  };
}

export function appendOverlayAction(state: LogState, action: Omit<OverlayAction, "id" | "timestamp">): LogState {
  return {
    ...state,
    actions: [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ...action
      },
      ...state.actions
    ]
  };
}

export function upsertOverlayAction(state: LogState, action: OverlayAction): LogState {
  return {
    ...state,
    actions: [action, ...state.actions.filter((item) => item.id !== action.id)]
  };
}

export function setWebviewMode(state: LogState, webviewMode: WebviewMode): LogState {
  return { ...state, webviewMode };
}

export function exportLogJson(state: LogState): string {
  const derived = deriveLogState(state);
  const markers = state.events.filter((event) => event.source === "marker");
  return JSON.stringify(
    {
      app: bridge.metadata.name,
      version: bridge.metadata.version,
      exportedAt: new Date().toISOString(),
      officialPageUrl: state.officialUrl,
      currentRoute: derived.currentRoute,
      deviceConnectStatus: derived.deviceConnectStatus,
      officialDriverStatus: derived.officialDriverStatus,
      latestDeviceMetadata: derived.latestDeviceMetadata ?? null,
      eventCount: state.events.length,
      markersCount: markers.length,
      webviewMode: state.webviewMode,
      session: {
        status: state.session.active ? "active" : state.session.endedAt ? "ended" : "not-started",
        active: state.session.active,
        startedAt: state.session.startedAt ?? null,
        endedAt: state.session.endedAt ?? null,
        markerCount: markers.filter((event) => isSessionMarker(event)).length
      },
      overlayActions: [...state.actions].reverse(),
      adapterCommandResults: [...state.actions].reverse(),
      events: [...state.events].reverse(),
      markers: [...markers].reverse(),
      safetyNote: "Logs may contain device protocol data. Do not commit raw logs publicly unless they are intentionally reviewed, tiny, and redacted."
    },
    null,
    2
  );
}

function deviceConnectStatus(events: OverlayLogEvent[]): string {
  const text = events.map((event) => `${event.summary} ${event.text ?? ""} ${event.productName ?? ""}`).join(" ").toLowerCase();
  if (text.includes("wired connection") || text.includes("connected")) return "Connected";
  if (events.some((event) => event.vendorId === 3141 && event.productId === 32956)) return "Device permission remembered";
  if (text.includes("permission")) return "Permission needed";
  if (events.some((event) => event.source === "dom")) return "Official loaded";
  return "Unknown";
}

function isSessionMarker(event: OverlayLogEvent): boolean {
  return event.source === "marker" && (event.markerLabel === "Session started" || event.markerLabel === "Session stopped");
}

export function routeFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hash || parsed.pathname || "/";
  } catch {
    return "/";
  }
}

function officialUrlForState(currentUrl: string, nextUrl?: string): string {
  if (!nextUrl) return currentUrl;
  const currentRoute = routeFromUrl(currentUrl);
  const nextRoute = routeFromUrl(nextUrl);
  if (nextRoute === "/" && currentRoute !== "/") return currentUrl;
  return nextUrl;
}

function hasRecentDuplicateDiagnostic(events: OverlayLogEvent[], next: OverlayLogEvent): boolean {
  return events.slice(0, 25).some((event) => isDuplicateDiagnostic(event, next));
}

function isDuplicateDiagnostic(previous: OverlayLogEvent | undefined, next: OverlayLogEvent): boolean {
  if (!previous) return false;
  if (next.source === "webhid" || previous.source === "webhid") return false;
  const previousTime = Date.parse(previous.timestamp);
  const nextTime = Date.parse(next.timestamp);
  if (!Number.isFinite(previousTime) || !Number.isFinite(nextTime)) return false;
  if (Math.abs(nextTime - previousTime) > 1000) return false;
  if (previous.route === next.route && previous.source === "host" && next.source === "host" && isNoisyLifecycle(previous.type) && isNoisyLifecycle(next.type)) return true;
  if (previous.route === next.route && previous.source === "dom" && next.source === "dom" && isNoisyDom(previous.type) && isNoisyDom(next.type)) return true;
  return previous.source === next.source
    && previous.type === next.type
    && previous.phase === next.phase
    && previous.method === next.method
    && previous.route === next.route
    && previous.summary === next.summary;
}

function isNoisyLifecycle(type: string): boolean {
  return type === "did-start-loading"
    || type === "did-stop-loading"
    || type === "did-finish-load"
    || type === "did-navigate"
    || type === "did-navigate-in-page"
    || type === "page-title-updated"
    || type === "dom-ready";
}

function isNoisyDom(type: string): boolean {
  return type === "history.pushState"
    || type === "history.replaceState"
    || type === "hashchange"
    || type === "popstate"
    || type === "page-load"
    || type === "DOMContentLoaded";
}

export function timestampFilename(): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `ak680-overlay-diagnostics-${stamp}.json`;
}

function buildSummary(source: LogSource, type: string, method?: string, phase?: string, reportId?: number, length?: number, hex?: string, markerLabel?: string, error?: string): string {
  if (markerLabel) return markerLabel;
  if (error) return `${method ?? type} ${phase ?? "error"}: ${error}`;
  if (source === "webhid") {
    const packet = reportId !== undefined || length !== undefined ? ` r${reportId ?? "-"} ${length ?? 0}b` : "";
    const preview = hex ? ` ${hex.split(" ").slice(0, 8).join(" ")}` : "";
    return `${method ?? type} ${phase ?? ""}${packet}${preview}`.trim();
  }
  return `${type}${method ? ` ${method}` : ""}${phase ? ` ${phase}` : ""}`.trim();
}

function packetSummary(event?: OverlayLogEvent): string {
  if (!event) return "none";
  const id = event.reportId === undefined ? "r-" : `r${event.reportId}`;
  const size = `${event.length ?? 0}b`;
  const hex = event.hex ? ` ${event.hex.split(" ").slice(0, 8).join(" ")}` : "";
  return `${id} ${size}${hex}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function primitiveValue(value: unknown): string | number | boolean | undefined {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : undefined;
}

function numberArray(value: unknown): number[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : undefined;
}

function sourceValue(value: unknown): LogSource {
  return value === "webhid" || value === "dom" || value === "marker" || value === "host" || value === "system" ? value : "system";
}

function phaseValue(value: unknown): LogPhase | undefined {
  return value === "before" || value === "after" || value === "error" || value === "input" || value === "event" ? value : undefined;
}
