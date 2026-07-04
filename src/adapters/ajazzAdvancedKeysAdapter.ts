import type { OfficialNavigator } from "./ajazzRouteAdapter";

export function detectRoute(url = "https://ajazz.driveall.cn/") {
  return { section: "advanced-keys", url };
}

export function getOfficialPath(): string {
  return "/advanced-keys";
}

export function goToOfficialPath(navigate: OfficialNavigator): void {
  // TODO: future DOM control can observe advanced-key state. Do not automate SOCD or write packets.
  navigate(getOfficialPath());
}
