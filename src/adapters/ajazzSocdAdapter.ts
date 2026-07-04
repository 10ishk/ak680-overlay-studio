export function detectRoute(url = "https://ajazz.driveall.cn/") {
  return { section: "socd", url };
}

export function goToOfficialPath(path: string): string {
  // TODO: observe official SOCD routes only. Do not automate SOCD writes here.
  return new URL(path, "https://ajazz.driveall.cn/").toString();
}
