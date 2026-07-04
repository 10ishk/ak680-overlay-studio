import { contextBridge } from "electron";

const metadata = {
  name: "AK680 Overlay Studio",
  version: "0.1.0",
  officialDriverUrl: "https://ajazz.driveall.cn/",
  targetDevice: "AJAZZ AK680 V2",
  vid: 3141,
  pid: 32956
};

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
  }
});
