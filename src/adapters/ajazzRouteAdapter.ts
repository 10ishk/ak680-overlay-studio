export type OfficialRoute = {
  path: string;
  label: string;
};

export function detectRoute(url = "https://ajazz.driveall.cn/"): OfficialRoute {
  const parsed = new URL(url);
  const path = parsed.hash || parsed.pathname || "/";
  return { path, label: path === "/" ? "Home" : path.replace(/^#?\//, "") };
}

export function goToOfficialPath(path: string): string {
  // TODO: wire this to the official webview once route controls are observed.
  return new URL(path, "https://ajazz.driveall.cn/").toString();
}
