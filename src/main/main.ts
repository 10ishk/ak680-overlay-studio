import { app, BrowserWindow, session } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OFFICIAL_ORIGIN = "https://ajazz.driveall.cn";

function isAjazzOrigin(url: string): boolean {
  try {
    return new URL(url).origin === OFFICIAL_ORIGIN;
  } catch {
    return false;
  }
}

type PermissionEvent = {
  type: string;
  permission?: string;
  origin?: string;
  allowed: boolean;
  timestamp: string;
};

function configurePermissions(notify: (event: PermissionEvent) => void): void {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl || webContents.getURL();
    if (String(permission) === "hid" && isAjazzOrigin(requestingUrl)) {
      notify({ type: "permission-request", permission: String(permission), origin: requestingUrl, allowed: true, timestamp: new Date().toISOString() });
      callback(true);
      return;
    }
    notify({ type: "permission-request", permission: String(permission), origin: requestingUrl, allowed: false, timestamp: new Date().toISOString() });
    callback(false);
  });

  ses.setDevicePermissionHandler((details) => {
    const allowed = details.deviceType === "hid" && isAjazzOrigin(details.origin);
    notify({ type: "device-permission", permission: details.deviceType, origin: details.origin, allowed, timestamp: new Date().toISOString() });
    return allowed;
  });

  ses.setUSBProtectedClassesHandler(() => []);
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 720,
    title: "AK680 Overlay Studio",
    backgroundColor: "#08090b",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    }
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    void win.loadURL(devServer);
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  return win;
}

app.whenReady().then(() => {
  const windows = new Set<BrowserWindow>();
  configurePermissions((event) => {
    for (const win of windows) {
      win.webContents.send("ak680-permission-event", event);
    }
  });
  const firstWindow = createWindow();
  windows.add(firstWindow);
  firstWindow.on("closed", () => windows.delete(firstWindow));

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createWindow();
      windows.add(win);
      win.on("closed", () => windows.delete(win));
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
