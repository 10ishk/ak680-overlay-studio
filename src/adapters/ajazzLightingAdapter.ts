import type { OfficialNavigator } from "./ajazzRouteAdapter";

export function detectRoute(url = "https://ajazz.driveall.cn/") {
  return { section: "lighting", url, readyText: ["Lighting", "Static Bright", "Snowfall", "Brightness"] };
}

export function getOfficialPath(): string {
  return "/lighting";
}

export function goToOfficialPath(navigate: OfficialNavigator): void {
  // TODO: refine official lighting selectors. Use official DOM controls only; never send packets.
  navigate(getOfficialPath());
}

export function expectedPageText(): string[] {
  return ["Lighting", "Static Bright", "Snowfall", "Brightness"];
}
