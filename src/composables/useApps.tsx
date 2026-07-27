import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import {
  detectInstall,
  downloadApp,
  getAppDetails,
  launchApp,
  listApps,
  refreshManifests,
  uninstallApp,
} from "@/lib/apps";
import { contrastForeground } from "@/lib/color";
import type {
  AppInstallDetails,
  AppSummary,
  DownloadProgress,
  InstallPhase,
  InstallStatus,
} from "@/types/apps";

type ActionError = {
  appId: string;
  message: string;
};

type AppsContextValue = {
  apps: AppSummary[];
  loading: boolean;
  error: string | null;
  actionError: ActionError | null;
  downloadingId: string | null;
  uninstallingId: string | null;
  progress: DownloadProgress | null;
  installPhase: InstallPhase | null;
  accent: string;
  setAccent: (color: string) => void;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
  install: (appId: string) => Promise<void>;
  uninstall: (appId: string) => Promise<void>;
  launch: (appId: string) => Promise<void>;
  rediscover: (appId: string) => Promise<void>;
  fetchDetails: (appId: string) => Promise<AppInstallDetails>;
  clearActionError: () => void;
};

const AppsContext = createContext<AppsContextValue | null>(null);
const DEFAULT_ACCENT = "#6a6dfb";

export function AppsProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [installPhase, setInstallPhase] = useState<InstallPhase | null>(null);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);

  const clearActionError = useCallback(() => setActionError(null), []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listApps();
      setApps(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await refreshManifests();
      setApps(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenStatus: (() => void) | undefined;

    listen<DownloadProgress>("download-progress", (event) => {
      setProgress(event.payload);
      setInstallPhase("downloading");
    }).then((fn) => {
      unlistenProgress = fn;
    });

    listen<InstallStatus>("install-status", (event) => {
      setInstallPhase(event.payload.phase);
      if (event.payload.phase !== "downloading") {
        setProgress(null);
      }
    }).then((fn) => {
      unlistenStatus = fn;
    });

    return () => {
      unlistenProgress?.();
      unlistenStatus?.();
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--primary", accent);
    document.documentElement.style.setProperty("--ring", accent);
    document.documentElement.style.setProperty("--brand", accent);
    document.documentElement.style.setProperty("--stage-accent", accent);
    document.documentElement.style.setProperty(
      "--primary-foreground",
      contrastForeground(accent)
    );
  }, [accent]);

  const install = useCallback(
    async (appId: string) => {
      setDownloadingId(appId);
      setProgress(null);
      setInstallPhase("downloading");
      setActionError(null);
      try {
        await downloadApp(appId);
        await reload();
      } catch (e) {
        setActionError({
          appId,
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setDownloadingId(null);
        setProgress(null);
        setInstallPhase(null);
      }
    },
    [reload]
  );

  const uninstall = useCallback(
    async (appId: string) => {
      setUninstallingId(appId);
      setInstallPhase("uninstalling");
      setActionError(null);
      try {
        await uninstallApp(appId);
        await reload();
      } catch (e) {
        setActionError({
          appId,
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setUninstallingId(null);
        setInstallPhase(null);
      }
    },
    [reload]
  );

  const fetchDetails = useCallback(async (appId: string) => {
    return getAppDetails(appId);
  }, []);

  const launch = useCallback(async (appId: string) => {
    setActionError(null);
    try {
      await launchApp(appId);
    } catch (e) {
      setActionError({
        appId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  const rediscover = useCallback(
    async (appId: string) => {
      setActionError(null);
      try {
        const found = await detectInstall(appId);
        if (!found) {
          setActionError({
            appId,
            message: t("app.detectNotFound"),
          });
        }
        await reload();
      } catch (e) {
        setActionError({
          appId,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [reload, t]
  );

  const value = useMemo(
    () => ({
      apps,
      loading,
      error,
      actionError,
      downloadingId,
      uninstallingId,
      progress,
      installPhase,
      accent,
      setAccent,
      reload,
      refresh,
      install,
      uninstall,
      launch,
      rediscover,
      fetchDetails,
      clearActionError,
    }),
    [
      apps,
      loading,
      error,
      actionError,
      downloadingId,
      uninstallingId,
      progress,
      installPhase,
      accent,
      reload,
      refresh,
      install,
      uninstall,
      launch,
      rediscover,
      fetchDetails,
      clearActionError,
    ]
  );

  return <AppsContext.Provider value={value}>{children}</AppsContext.Provider>;
}

export function useApps() {
  const ctx = useContext(AppsContext);
  if (!ctx) throw new Error("useApps must be used within AppsProvider");
  return ctx;
}
