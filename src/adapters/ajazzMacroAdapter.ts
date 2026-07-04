import type { OfficialNavigator } from "./ajazzRouteAdapter";

export function detectRoute(url = "https://ajazz.driveall.cn/") {
  return { section: "macros", url, readyText: ["Macro", "Record", "New"] };
}

export function getOfficialPath(): string {
  return "/macro";
}

export function goToOfficialPath(navigate: OfficialNavigator): void {
  // TODO: future DOM control can observe macro state. No recording automation or writes here.
  navigate(getOfficialPath());
}

export function expectedPageText(): string[] {
  return ["Macro", "Record", "New"];
}
