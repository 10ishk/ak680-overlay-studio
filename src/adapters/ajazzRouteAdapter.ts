export type OfficialRoute = {
  path: string;
  label: string;
  readyText: string[];
};

export type OfficialNavigator = (path: string) => void;

const OFFICIAL_ORIGIN = "https://ajazz.driveall.cn";

export function detectRoute(url = "https://ajazz.driveall.cn/"): OfficialRoute {
  const parsed = new URL(url);
  const path = parsed.hash || parsed.pathname || "/";
  return { path, label: path === "/" ? "Home" : path.replace(/^#?\//, ""), readyText: ["AJAZZ", "AK680", "Connect"] };
}

export function getOfficialPath(): string {
  return "/";
}

export function goToOfficialPath(navigate: OfficialNavigator, path = getOfficialPath()): void {
  // TODO: future route adapters may observe official DOM state. Do not click or write in MVP.
  navigate(new URL(path, `${OFFICIAL_ORIGIN}/`).pathname);
}

export function isExpectedPageTextPresent(snapshot: string[] = [], expected: string[] = detectRoute().readyText): boolean {
  const haystack = snapshot.join(" ").toLowerCase();
  return expected.some((item) => haystack.includes(item.toLowerCase()));
}

export async function waitForRouteReady(snapshotProvider: () => Promise<string[]>, expected: string[], timeoutMs = 3500): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (isExpectedPageTextPresent(await snapshotProvider(), expected)) return true;
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  return false;
}
