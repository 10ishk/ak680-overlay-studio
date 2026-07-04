import type { OfficialNavigator } from "./ajazzRouteAdapter";

export function detectRoute(url = "https://ajazz.driveall.cn/") {
  return { section: "macros", url };
}

export function getOfficialPath(): string {
  return "/macro";
}

export function goToOfficialPath(navigate: OfficialNavigator): void {
  // TODO: future DOM control can observe macro state. No recording automation or writes here.
  navigate(getOfficialPath());
}
