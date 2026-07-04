export type Ak680Metadata = {
  name: string;
  version: string;
  officialDriverUrl: string;
  webviewPreloadPath?: string;
  targetDevice: string;
  vid: number;
  pid: number;
};

export type LogMarker = {
  id: string;
  type: "marker";
  label: string;
  createdAt: string;
};

export type Ak680Bridge = {
  metadata: Ak680Metadata;
  logger: {
    addMarker(label: string): LogMarker;
    exportPlaceholder(events: unknown[]): string;
  };
  host?: {
    onPermissionEvent(callback: (event: unknown) => void): () => void;
  };
};

declare global {
  interface Window {
    ak680?: Ak680Bridge;
  }
}

export function getBridge(): Ak680Bridge {
  return (
    window.ak680 ?? {
      metadata: {
        name: "AK680 Overlay Studio",
        version: "0.1.0",
        officialDriverUrl: "https://ajazz.driveall.cn/",
        webviewPreloadPath: undefined,
        targetDevice: "AJAZZ AK680 V2",
        vid: 3141,
        pid: 32956
      },
      logger: {
        addMarker(label: string) {
          return {
            id: crypto.randomUUID(),
            type: "marker",
            label,
            createdAt: new Date().toISOString()
          };
        },
        exportPlaceholder(events: unknown[]) {
          return JSON.stringify({ events }, null, 2);
        }
      }
    }
  );
}
