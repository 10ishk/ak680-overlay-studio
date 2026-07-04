import type { OfficialNavigator } from "./ajazzRouteAdapter";

export function detectRoute(url = "https://ajazz.driveall.cn/") {
  return { section: "performance", url, readyText: ["Performance", "Trigger", "Fast Trigger", "Calibration"] };
}

export function getOfficialPath(): string {
  return "/performance";
}

export function goToOfficialPath(navigate: OfficialNavigator): void {
  // TODO: refine official performance selectors. No native writes or packet sending.
  navigate(getOfficialPath());
}

export function expectedPageText(): string[] {
  return ["Performance", "Trigger", "Fast Trigger", "Calibration"];
}
