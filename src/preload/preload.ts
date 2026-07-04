import { contextBridge, ipcRenderer } from "electron";
import path from "node:path";

const metadata = {
  name: "AK680 Overlay Studio",
  version: "0.1.0",
  officialDriverUrl: "https://ajazz.driveall.cn/custom-keys",
  webviewPreloadPath: path.join(__dirname, "webviewLogger.cjs"),
  targetDevice: "AJAZZ AK680 V2",
  vid: 3141,
  pid: 32956
};

if (process.env.NODE_ENV !== "production") {
  console.log("AK680 preload loaded");
}

contextBridge.exposeInMainWorld("ak680", {
  metadata,
  logger: {
    addMarker(label: string) {
      return {
        id: crypto.randomUUID(),
        type: "marker",
        label: String(label || "Manual marker"),
        createdAt: new Date().toISOString()
      };
    },
    exportPlaceholder(events: unknown[]) {
      return JSON.stringify(
        {
          app: metadata.name,
          exportedAt: new Date().toISOString(),
          events
        },
        null,
        2
      );
    }
  },
  host: {
    onPermissionEvent(callback: (event: unknown) => void) {
      const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
      ipcRenderer.on("ak680-permission-event", listener);
      return () => ipcRenderer.removeListener("ak680-permission-event", listener);
    }
  }
});
