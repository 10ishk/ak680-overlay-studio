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
};

export type LogDerivedState = {
  eventCount: number;
  markersCount: number;
  currentRoute: string;
  lastAction: string;
  lastTxPacket: string;
  lastRxPacket: string;
  connectedDeviceStatus: string;
  latestDeviceMetadata?: DeviceMetadata;
};

const bridge = getBridge();

export const initialLogState: LogState = {
  officialUrl: bridge.metadata.officialDriverUrl,
  events: [
    {
      id: "boot",
      timestamp: new Date().toISOString(),
      source: "system",
      type: "boot",
      phase: "event",
      summary: "Overlay shell ready",
      route: "/",
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
  return {
    officialUrl: event.url ?? state.officialUrl,
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
    latestDeviceMetadata
  };
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
      latestDeviceMetadata: derived.latestDeviceMetadata ?? null,
      eventCount: state.events.length,
      markersCount: markers.length,
      events: [...state.events].reverse(),
      markers: [...markers].reverse(),
      safetyNote: "Logs may contain device protocol data. Do not commit raw logs publicly unless they are intentionally reviewed, tiny, and redacted."
    },
    null,
    2
  );
}

export function routeFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hash || parsed.pathname || "/";
  } catch {
    return "/";
  }
}

export function timestampFilename(): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `ak680-overlay-log-${stamp}.json`;
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
