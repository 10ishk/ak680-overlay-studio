export function detectRoute(url = "https://ajazz.driveall.cn/") {
  return { section: "advanced-keys", url };
}

export function goToOfficialPath(path: string): string {
  // TODO: locate official advanced-key DOM routes later. No automation in MVP.
  return new URL(path, "https://ajazz.driveall.cn/").toString();
}
