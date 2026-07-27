import type { AppSummary } from "@/types/apps";

export function appIsInstalled(app: AppSummary): boolean {
  return Boolean(app.install?.executablePath);
}

export function appNeedsUpdate(app: AppSummary): boolean {
  const installed = appIsInstalled(app);
  const remote = app.remoteVersion ?? null;
  const local = app.install?.version ?? null;
  return Boolean(
    installed && remote && local && remote !== local && local !== "unknown"
  );
}

export type AppStatusKey = "installed" | "updateAvailable" | "notInstalled";

export function appStatusKey(app: AppSummary): AppStatusKey {
  if (!appIsInstalled(app)) return "notInstalled";
  if (appNeedsUpdate(app)) return "updateAvailable";
  return "installed";
}
