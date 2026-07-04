export const OFFICIAL_ORIGIN = "https://ajazz.driveall.cn";

export const officialPaths = {
  home: "/",
  keymap: "/custom-keys",
  lighting: "/lighting",
  macros: "/macro",
  performance: "/performance",
  advancedKeys: "/advanced-keys",
  settings: "/settings"
} as const;

export type OfficialPath = typeof officialPaths[keyof typeof officialPaths];

export type OfficialDriverController = {
  loadOfficialPath(path: OfficialPath): void;
};

export type WebviewCommandType =
  | "detectOfficialState"
  | "getCurrentRoute"
  | "navigateToPath"
  | "clickByText"
  | "clickBySelector"
  | "setInputValue"
  | "setRangeValue"
  | "setRadioByLabel"
  | "setToggleByLabel"
  | "getVisibleTextSnapshot"
  | "snapshotVisibleButtons"
  | "snapshotVisibleInputs"
  | "snapshotVisibleTabs"
  | "snapshotPageTextSummary"
  | "snapshotActiveElements"
  | "waitForText"
  | "waitForSelector"
  | "setRangeByNearbyLabel"
  | "clickButtonNearText"
  | "getRememberedHidDevices";

export type WebviewCommand = {
  id: string;
  type: WebviewCommandType;
  path?: OfficialPath;
  text?: string;
  selector?: string;
  value?: string | number | boolean;
  tag?: string;
  nearText?: string;
  timeoutMs?: number;
};

export type WebviewCommandResult = {
  id: string;
  ok: boolean;
  type: WebviewCommandType;
  command: WebviewCommandType;
  commandId: string;
  timestamp: string;
  success: boolean;
  message: string;
  route?: string;
  matchedText?: string;
  selector?: string;
  snapshot?: string[];
  details?: unknown;
};

const allowedPaths = new Set<string>(Object.values(officialPaths));

export function toOfficialUrl(path: OfficialPath): string {
  return new URL(path, `${OFFICIAL_ORIGIN}/`).toString();
}

export function isAllowedOfficialUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === OFFICIAL_ORIGIN && allowedPaths.has(parsed.pathname || "/");
  } catch {
    return false;
  }
}

export function pathFromUrl(url: string): OfficialPath {
  try {
    const parsed = new URL(url);
    return allowedPaths.has(parsed.pathname) ? parsed.pathname as OfficialPath : officialPaths.home;
  } catch {
    return officialPaths.home;
  }
}

export function createCommand(type: WebviewCommandType, options: Omit<WebviewCommand, "id" | "type"> = {}): WebviewCommand {
  return {
    id: crypto.randomUUID(),
    type,
    timeoutMs: 3500,
    ...options
  };
}

export function commandResultFromPayload(payload: unknown): WebviewCommandResult | undefined {
  if (!isRecord(payload)) return undefined;
  const commandResult = payload.commandResult;
  if (!isRecord(commandResult)) return undefined;
  if (typeof commandResult.id !== "string" || typeof commandResult.type !== "string" || typeof commandResult.success !== "boolean") return undefined;
  return {
    id: commandResult.id,
    ok: commandResult.ok === true || commandResult.success === true,
    type: commandResult.type as WebviewCommandType,
    command: (typeof commandResult.command === "string" ? commandResult.command : commandResult.type) as WebviewCommandType,
    commandId: typeof commandResult.commandId === "string" ? commandResult.commandId : commandResult.id,
    timestamp: typeof commandResult.timestamp === "string" ? commandResult.timestamp : new Date().toISOString(),
    success: commandResult.success,
    message: typeof commandResult.message === "string" ? commandResult.message : "",
    route: typeof commandResult.route === "string" ? commandResult.route : undefined,
    matchedText: typeof commandResult.matchedText === "string" ? commandResult.matchedText : undefined,
    selector: typeof commandResult.selector === "string" ? commandResult.selector : undefined,
    snapshot: Array.isArray(commandResult.snapshot) ? commandResult.snapshot.filter((item): item is string => typeof item === "string") : undefined,
    details: commandResult.details
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
