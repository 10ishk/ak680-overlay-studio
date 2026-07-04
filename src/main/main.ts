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

function configurePermissions(): void {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl || webContents.getURL();
    if (String(permission) === "hid" && isAjazzOrigin(requestingUrl)) {
      callback(true);
      return;
    }
    callback(false);
  });

  ses.setDevicePermissionHandler((details) => {
    return details.deviceType === "hid" && isAjazzOrigin(details.origin);
  });

  ses.setUSBProtectedClassesHandler(() => []);
}

function createWindow(): void {
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
}

app.whenReady().then(() => {
  configurePermissions();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
