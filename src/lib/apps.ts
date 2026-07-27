import { invoke } from "@tauri-apps/api/core";
import type { AppInstallDetails, AppSummary, InstallRecord } from "@/types/apps";

export async function listApps(): Promise<AppSummary[]> {
  return invoke("list_apps");
}

export async function refreshManifests(): Promise<AppSummary[]> {
  return invoke("refresh_manifests");
}

export async function clearManifestCache(): Promise<void> {
  return invoke("clear_manifest_cache");
}

export async function downloadApp(appId: string): Promise<InstallRecord> {
  return invoke("download_app", { appId });
}

export async function launchApp(appId: string): Promise<void> {
  return invoke("launch_app", { appId });
}

export async function detectInstall(appId: string): Promise<InstallRecord | null> {
  return invoke("detect_install", { appId });
}

export async function getAppDetails(appId: string): Promise<AppInstallDetails> {
  return invoke("get_app_details", { appId });
}

export async function uninstallApp(appId: string): Promise<void> {
  return invoke("uninstall_app", { appId });
}
