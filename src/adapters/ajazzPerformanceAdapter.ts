import type { OfficialNavigator } from "./ajazzRouteAdapter";

export function detectRoute(url = "https://ajazz.driveall.cn/") {
  return { section: "performance", url };
}

export function getOfficialPath(): string {
  return "/performance";
}

export function goToOfficialPath(navigate: OfficialNavigator): void {
  // TODO: future DOM control can observe performance state. No native writes or packet sending.
  navigate(getOfficialPath());
}
