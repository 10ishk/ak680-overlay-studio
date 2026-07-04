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
