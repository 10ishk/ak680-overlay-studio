import { ipcRenderer } from "electron";

type LogPayload = Record<string, unknown>;
type HidLike = {
  requestDevice?: (...args: unknown[]) => Promise<HidDeviceLike[]>;
  getDevices?: (...args: unknown[]) => Promise<HidDeviceLike[]>;
};
type HidDeviceLike = EventTarget & {
  productName?: string;
  vendorId?: number;
  productId?: number;
  opened?: boolean;
  collections?: Array<{ usagePage?: number; usage?: number }>;
  open?: (...args: unknown[]) => Promise<unknown>;
  close?: (...args: unknown[]) => Promise<unknown>;
  sendReport?: (...args: unknown[]) => Promise<unknown>;
  sendFeatureReport?: (...args: unknown[]) => Promise<unknown>;
  receiveFeatureReport?: (...args: unknown[]) => Promise<unknown>;
  addEventListener: EventTarget["addEventListener"];
  dispatchEvent: EventTarget["dispatchEvent"];
};
type HidInputReportLike = Event & {
  device?: HidDeviceLike;
  reportId?: number;
  data?: DataView;
};

const SOURCE = "webhid";
const OFFICIAL_ORIGIN = "https://ajazz.driveall.cn";

type WebviewCommand = {
  id: string;
  type:
    | "detectOfficialState"
    | "getCurrentRoute"
    | "navigateToPath"
    | "clickByText"
    | "clickBySelector"
    | "setInputValue"
    | "setRangeValue"
    | "setRadioByLabel"
    | "setToggleByLabel"
    | "getVisibleTextSnapshot";
  path?: string;
  text?: string;
  selector?: string;
  value?: string | number | boolean;
  timeoutMs?: number;
};

type CommandResult = {
  id: string;
  type: string;
  success: boolean;
  message: string;
  route?: string;
  matchedText?: string;
  selector?: string;
  snapshot?: string[];
};

function emit(payload: LogPayload): void {
  try {
    ipcRenderer.sendToHost("ak680-log-event", {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      url: location.href,
      route: location.hash || location.pathname || "/",
      ...payload
    });
  } catch {
    // Logging must never interfere with the official driver.
  }
}

function emitCommandResult(result: CommandResult): void {
  emit({
    source: "dom",
    type: "adapter-command",
    phase: result.success ? "after" : "error",
    summary: `${result.type}: ${result.message}`,
    commandResult: result
  });
}

function summarizeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function toBytes(value: unknown): number[] | undefined {
  try {
    if (value == null) return undefined;
    if (ArrayBuffer.isView(value)) {
      const view = value as ArrayBufferView;
      return Array.from(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    }
    if (value instanceof ArrayBuffer) return Array.from(new Uint8Array(value));
    if (Array.isArray(value)) return value.map(Number).filter((item) => Number.isFinite(item)).map((item) => item & 255);
    if (typeof value === "object" && "buffer" in value && value.buffer instanceof ArrayBuffer) {
      const bufferLike = value as { buffer: ArrayBuffer; byteOffset?: number; byteLength?: number };
      return Array.from(new Uint8Array(bufferLike.buffer, bufferLike.byteOffset ?? 0, bufferLike.byteLength));
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function hex(bytes?: number[]): string | undefined {
  return bytes?.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

function deviceInfo(device: unknown): LogPayload {
  const hidDevice = device as {
    productName?: string;
    vendorId?: number;
    productId?: number;
    opened?: boolean;
    collections?: Array<{ usagePage?: number; usage?: number }>;
  };
  const firstCollection = hidDevice.collections?.[0];
  return {
    productName: hidDevice.productName,
    vendorId: hidDevice.vendorId,
    productId: hidDevice.productId,
    opened: hidDevice.opened,
    collections: hidDevice.collections,
    usagePage: firstCollection?.usagePage,
    usage: firstCollection?.usage
  };
}

function packetFields(reportId?: unknown, data?: unknown): LogPayload {
  const bytes = toBytes(data);
  return {
    reportId: typeof reportId === "number" ? reportId : undefined,
    length: bytes?.length,
    bytes,
    hex: hex(bytes)
  };
}

function emitHid(method: string, phase: "before" | "after" | "error" | "input", extra: LogPayload = {}): void {
  emit({
    source: SOURCE,
    type: "hid",
    method,
    phase,
    summary: `${method} ${phase}`,
    ...extra
  });
}

function wrapNavigatorHid(): void {
  try {
    const hid = (navigator as Navigator & { hid?: HidLike }).hid;
    if (!hid) return;

    const originalRequestDevice = hid.requestDevice?.bind(hid);
    if (originalRequestDevice) {
      hid.requestDevice = async (...args: unknown[]) => {
        emitHid("navigator.hid.requestDevice", "before");
        try {
          const devices = await originalRequestDevice(...args);
          emitHid("navigator.hid.requestDevice", "after", { devices: devices.map(deviceInfo) });
          return devices;
        } catch (error) {
          emitHid("navigator.hid.requestDevice", "error", { error: summarizeError(error) });
          throw error;
        }
      };
    }

    const originalGetDevices = hid.getDevices?.bind(hid);
    if (originalGetDevices) {
      hid.getDevices = async (...args: unknown[]) => {
        emitHid("navigator.hid.getDevices", "before");
        try {
          const devices = await originalGetDevices(...args);
          emitHid("navigator.hid.getDevices", "after", { devices: devices.map(deviceInfo) });
          return devices;
        } catch (error) {
          emitHid("navigator.hid.getDevices", "error", { error: summarizeError(error) });
          throw error;
        }
      };
    }
  } catch {
    return;
  }
}

function wrapHidDevice(): void {
  try {
    const HIDDeviceCtor = (window as Window & { HIDDevice?: { prototype?: HidDeviceLike } }).HIDDevice;
    if (!HIDDeviceCtor?.prototype) return;
    const proto = HIDDeviceCtor.prototype;

    wrapMethod(proto, "open", function before(device) {
      return deviceInfo(device);
    });
    wrapMethod(proto, "close", function before(device) {
      return deviceInfo(device);
    });
    wrapMethod(proto, "sendReport", function before(device, args) {
      return { ...deviceInfo(device), ...packetFields(args[0], args[1]) };
    });
    wrapMethod(proto, "sendFeatureReport", function before(device, args) {
      return { ...deviceInfo(device), ...packetFields(args[0], args[1]) };
    });
    wrapMethod(proto, "receiveFeatureReport", function before(device, args) {
      return { ...deviceInfo(device), reportId: args[0] };
    }, function after(device, _args, result) {
      return { ...deviceInfo(device), ...packetFields(undefined, result) };
    });

    const originalAddEventListener = proto.addEventListener;
    if (typeof originalAddEventListener === "function" && !("__ak680WrappedAddEventListener" in proto)) {
      Object.defineProperty(proto, "__ak680WrappedAddEventListener", { value: true });
      proto.addEventListener = function patchedAddEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
        if (type === "inputreport") {
          emitHid("HIDDevice.addEventListener", "after", deviceInfo(this));
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
    }

    const originalDispatchEvent = proto.dispatchEvent;
    if (typeof originalDispatchEvent === "function" && !("__ak680WrappedDispatchEvent" in proto)) {
      Object.defineProperty(proto, "__ak680WrappedDispatchEvent", { value: true });
      proto.dispatchEvent = function patchedDispatchEvent(event: Event) {
        if (event.type === "inputreport") logInputReport(event);
        return originalDispatchEvent.call(this, event);
      };
    }
  } catch {
    return;
  }
}

function wrapMethod(
  proto: HidDeviceLike,
  name: keyof HidDeviceLike,
  beforeFields: (device: HidDeviceLike, args: unknown[]) => LogPayload,
  afterFields?: (device: HidDeviceLike, args: unknown[], result: unknown) => LogPayload
): void {
  const original = proto[name];
  if (typeof original !== "function") return;
  const originalMethod = original as (this: HidDeviceLike, ...args: unknown[]) => unknown;
  const marker = `__ak680Wrapped_${String(name)}`;
  if (marker in proto) return;
  Object.defineProperty(proto, marker, { value: true });
  Object.defineProperty(proto, name, {
    value: async function patchedHidMethod(this: HidDeviceLike, ...args: unknown[]) {
      const method = `HIDDevice.${String(name)}`;
      try {
        emitHid(method, "before", beforeFields(this, args));
      } catch {
        // keep official call clean
      }
      try {
        const result = await originalMethod.apply(this, args);
        emitHid(method, "after", afterFields ? afterFields(this, args, result) : beforeFields(this, args));
        return result;
      } catch (error) {
        emitHid(method, "error", { ...beforeFields(this, args), error: summarizeError(error) });
        throw error;
      }
    }
  });
}

function logInputReport(event: Event): void {
  try {
    const inputEvent = event as HidInputReportLike;
    emitHid("inputreport", "input", {
      ...deviceInfo(inputEvent.device),
      ...packetFields(inputEvent.reportId, inputEvent.data)
    });
  } catch {
    return;
  }
}

function installDomLogger(): void {
  document.addEventListener("click", (event) => logElementEvent("click", event), true);
  document.addEventListener("input", (event) => logElementEvent("input", event), true);
  document.addEventListener("change", (event) => logElementEvent("change", event), true);
  window.addEventListener("hashchange", () => emitDom("hashchange"));
  window.addEventListener("popstate", () => emitDom("popstate"));
  document.addEventListener("DOMContentLoaded", () => emitDom("DOMContentLoaded", { selectedTabText: selectedTabText() }));

  const originalPushState = history.pushState;
  history.pushState = function patchedPushState(...args) {
    const result = originalPushState.apply(this, args);
    emitDom("history.pushState");
    return result;
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    emitDom("history.replaceState");
    return result;
  };

  emitDom("page-load", { selectedTabText: selectedTabText() });
}

function installCommandBridge(): void {
  try {
    ipcRenderer.on("ak680-command", (_event, command: WebviewCommand) => {
      void runCommand(command).then(emitCommandResult).catch((error) => {
        emitCommandResult({
          id: command?.id ?? crypto.randomUUID(),
          type: command?.type ?? "unknown",
          success: false,
          message: summarizeError(error)
        });
      });
    });
  } catch {
    return;
  }
}

async function runCommand(command: WebviewCommand): Promise<CommandResult> {
  if (location.origin !== OFFICIAL_ORIGIN) {
    return baseResult(command, false, "Command ignored outside official AJAZZ origin");
  }

  switch (command.type) {
    case "detectOfficialState":
      return {
        ...baseResult(command, true, "Official page visible"),
        snapshot: visibleTextSnapshot(18)
      };
    case "getCurrentRoute":
      return baseResult(command, true, location.pathname || "/");
    case "navigateToPath":
      return navigateToPath(command);
    case "clickByText":
      return clickByText(command);
    case "clickBySelector":
      return clickBySelector(command);
    case "setInputValue":
      return setInputValue(command);
    case "setRangeValue":
      return setRangeValue(command);
    case "setRadioByLabel":
      return setChoiceByLabel(command, "radio");
    case "setToggleByLabel":
      return setChoiceByLabel(command, "toggle");
    case "getVisibleTextSnapshot":
      return {
        ...baseResult(command, true, "Visible text snapshot captured"),
        snapshot: visibleTextSnapshot(40)
      };
    default:
      return baseResult(command, false, "Unsupported command");
  }
}

function baseResult(command: WebviewCommand, success: boolean, message: string): CommandResult {
  return {
    id: command.id,
    type: command.type,
    success,
    message,
    route: location.pathname || "/",
    selector: command.selector,
    matchedText: command.text
  };
}

function navigateToPath(command: WebviewCommand): CommandResult {
  const path = command.path ?? "/";
  if (!["/", "/custom-keys", "/lighting", "/macro", "/performance", "/advanced-keys", "/settings"].includes(path)) {
    return baseResult(command, false, `Blocked unknown official path ${path}`);
  }
  history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  return baseResult(command, true, `Navigated to ${path}`);
}

function clickByText(command: WebviewCommand): CommandResult {
  const text = sanitizeText(command.text);
  if (!text) return baseResult(command, false, "No text provided");
  const element = findClickableByText(text);
  if (!element) return baseResult(command, false, `Could not find visible text "${text}"`);
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  return { ...baseResult(command, true, `Clicked "${text}"`), matchedText: sanitizeText(element.textContent) };
}

function clickBySelector(command: WebviewCommand): CommandResult {
  if (!command.selector) return baseResult(command, false, "No selector provided");
  const element = document.querySelector(command.selector);
  if (!(element instanceof HTMLElement)) return baseResult(command, false, `Could not find selector ${command.selector}`);
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  return { ...baseResult(command, true, `Clicked selector ${command.selector}`), matchedText: sanitizeText(element.textContent) };
}

function setInputValue(command: WebviewCommand): CommandResult {
  const input = findInput(command);
  if (!input) return baseResult(command, false, "Could not find input");
  setNativeValue(input, String(command.value ?? ""));
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return baseResult(command, true, "Input value set through official DOM");
}

function setRangeValue(command: WebviewCommand): CommandResult {
  const input = findInput(command, "range");
  if (!input) return baseResult(command, false, "Could not find range input");
  setNativeValue(input, String(command.value ?? ""));
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return baseResult(command, true, "Range value set through official DOM");
}

function setChoiceByLabel(command: WebviewCommand, mode: "radio" | "toggle"): CommandResult {
  const text = sanitizeText(command.text);
  if (!text) return baseResult(command, false, "No label provided");
  const label = Array.from(document.querySelectorAll("label, button, [role='radio'], [role='switch'], [role='checkbox']")).find((item) => includesText(item, text));
  if (!(label instanceof HTMLElement)) return baseResult(command, false, `Could not find ${mode} label "${text}"`);
  label.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  return { ...baseResult(command, true, `Selected ${text}`), matchedText: sanitizeText(label.textContent) };
}

function findInput(command: WebviewCommand, type?: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  if (command.selector) {
    const selected = document.querySelector(command.selector);
    if (selected instanceof HTMLInputElement || selected instanceof HTMLTextAreaElement || selected instanceof HTMLSelectElement) return selected;
  }
  const text = sanitizeText(command.text);
  if (text) {
    const label = Array.from(document.querySelectorAll("label")).find((item) => includesText(item, text));
    const forId = label?.getAttribute("for");
    const byFor = forId ? document.getElementById(forId) : null;
    if (byFor instanceof HTMLInputElement || byFor instanceof HTMLTextAreaElement || byFor instanceof HTMLSelectElement) return byFor;
  }
  const selector = type ? `input[type="${type}"]` : "input, textarea, select";
  const first = document.querySelector(selector);
  return first instanceof HTMLInputElement || first instanceof HTMLTextAreaElement || first instanceof HTMLSelectElement ? first : null;
}

function findClickableByText(text: string): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll("button, [role='button'], [role='tab'], label, li, div, span, a"));
  const exact = candidates.find((item) => includesText(item, text, true));
  const loose = exact ?? candidates.find((item) => includesText(item, text));
  return loose instanceof HTMLElement ? loose : null;
}

function includesText(element: Element, text: string, exact = false): boolean {
  const content = sanitizeText(element.textContent)?.toLowerCase();
  const needle = text.toLowerCase();
  return exact ? content === needle : Boolean(content?.includes(needle));
}

function visibleTextSnapshot(limit: number): string[] {
  return Array.from(document.querySelectorAll("button, label, [role='tab'], [role='button'], h1, h2, h3, p, span"))
    .filter((item) => item instanceof HTMLElement && item.offsetParent !== null)
    .map((item) => sanitizeText(item.textContent))
    .filter((item): item is string => Boolean(item))
    .slice(0, limit);
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
}

function emitDom(type: string, extra: LogPayload = {}): void {
  emit({
    source: "dom",
    type,
    phase: "event",
    summary: `DOM ${type}`,
    ...extra
  });
}

function logElementEvent(type: string, event: Event): void {
  try {
    const target = event.target instanceof Element ? event.target : undefined;
    if (!target) return;
    const input = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement ? target : undefined;
    const payload: LogPayload = {
      tag: target.tagName.toLowerCase(),
      role: target.getAttribute("role"),
      text: sanitizeText(target.textContent),
      classSummary: classSummary(target),
      selectedTabText: selectedTabText()
    };

    if (input && !isSensitiveInput(input)) {
      if (input instanceof HTMLInputElement && input.type === "range") payload.value = Number(input.value);
      else if (input instanceof HTMLInputElement && (input.type === "checkbox" || input.type === "radio")) payload.value = input.checked;
      else payload.value = sanitizeText(input.value);
    } else if (input) {
      payload.value = "[redacted]";
    }

    emitDom(type, payload);
  } catch {
    return;
  }
}

function sanitizeText(value: string | null | undefined): string | undefined {
  const clean = value?.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  return clean.slice(0, 80);
}

function isSensitiveInput(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
  const name = `${input.getAttribute("name") ?? ""} ${input.id ?? ""} ${input.getAttribute("autocomplete") ?? ""} ${input.getAttribute("aria-label") ?? ""}`.toLowerCase();
  return input instanceof HTMLInputElement && input.type === "password" || /(token|secret|password|cookie|auth|key)/i.test(name);
}

function classSummary(element: Element): string | undefined {
  const classes = Array.from(element.classList).slice(0, 4).join(".");
  return classes ? `.${classes}` : undefined;
}

function selectedTabText(): string | undefined {
  const selected = document.querySelector('[aria-selected="true"], .active, .selected');
  return sanitizeText(selected?.textContent);
}

try {
  wrapNavigatorHid();
  wrapHidDevice();
  installDomLogger();
  installCommandBridge();
} catch {
  // The official page should continue even if the overlay logger cannot install.
}
