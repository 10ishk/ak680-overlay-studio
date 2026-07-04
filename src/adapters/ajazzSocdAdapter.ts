import type { OfficialNavigator } from "./ajazzRouteAdapter";

export function detectRoute(url = "https://ajazz.driveall.cn/") {
  return { section: "socd", url, readyText: ["SOCD", "Advanced", "RS", "Snappy"] };
}

export function getOfficialPath(): string {
  return "/advanced-keys";
}

export function goToOfficialPath(navigate: OfficialNavigator): void {
  // TODO: observe SOCD route context only. Do not automate SOCD setup in MVP.
  navigate(getOfficialPath());
}

export function expectedPageText(): string[] {
  return ["SOCD", "Advanced", "RS", "Snappy"];
}
