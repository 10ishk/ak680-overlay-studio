export function detectRoute(url = "https://ajazz.driveall.cn/") {
  return { section: "lighting", url };
}

export function goToOfficialPath(path: string): string {
  // TODO: map friendly lighting destinations to official DOM navigation.
  return new URL(path, "https://ajazz.driveall.cn/").toString();
}
