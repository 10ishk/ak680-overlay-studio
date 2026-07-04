import type { OfficialNavigator } from "./ajazzRouteAdapter";

export function detectRoute(url = "https://ajazz.driveall.cn/") {
  return { section: "lighting", url };
}

export function getOfficialPath(): string {
  return "/lighting";
}

export function goToOfficialPath(navigate: OfficialNavigator): void {
  // TODO: future DOM control can observe lighting state. Do not click controls or write packets in MVP.
  navigate(getOfficialPath());
}
