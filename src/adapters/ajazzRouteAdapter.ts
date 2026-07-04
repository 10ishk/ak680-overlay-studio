export type OfficialRoute = {
  path: string;
  label: string;
};

export type OfficialNavigator = (path: string) => void;

const OFFICIAL_ORIGIN = "https://ajazz.driveall.cn";

export function detectRoute(url = "https://ajazz.driveall.cn/"): OfficialRoute {
  const parsed = new URL(url);
  const path = parsed.hash || parsed.pathname || "/";
  return { path, label: path === "/" ? "Home" : path.replace(/^#?\//, "") };
}

export function getOfficialPath(): string {
  return "/";
}

export function goToOfficialPath(navigate: OfficialNavigator, path = getOfficialPath()): void {
  // TODO: future route adapters may observe official DOM state. Do not click or write in MVP.
  navigate(new URL(path, `${OFFICIAL_ORIGIN}/`).pathname);
}
