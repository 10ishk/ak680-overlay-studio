export function detectRoute(url = "https://ajazz.driveall.cn/") {
  return { section: "macros", url };
}

export function goToOfficialPath(path: string): string {
  // TODO: map macro pages after official DOM behavior is documented.
  return new URL(path, "https://ajazz.driveall.cn/").toString();
}
