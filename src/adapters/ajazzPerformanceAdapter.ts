export function detectRoute(url = "https://ajazz.driveall.cn/") {
  return { section: "performance", url };
}

export function goToOfficialPath(path: string): string {
  // TODO: map performance presets to official web driver views without sending packets.
  return new URL(path, "https://ajazz.driveall.cn/").toString();
}
