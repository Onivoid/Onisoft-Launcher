import { useEffect, useRef, useState } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";

type CheckStatus = "idle" | "checking" | "available" | "up-to-date" | "error";

export default function UpdatePage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<CheckStatus>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const totalSize = useRef<number>(0);
  const downloaded = useRef<number>(0);

  useEffect(() => {
    getVersion()
      .then(setCurrentVersion)
      .catch(() => undefined);
    void runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runCheck() {
    setStatus("checking");
    setError("");
    setUpdate(null);
    try {
      const u = await check();
      if (u?.available) {
        setUpdate(u);
        setStatus("available");
      } else {
        setStatus("up-to-date");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const missing =
        /could not fetch a valid release json/i.test(msg) || /404/i.test(msg);
      setError(missing ? t("update.noReleaseYet") : msg);
      setStatus("error");
    }
  }

  async function downloadAndInstall() {
    if (!update) return;
    try {
      setDownloading(true);
      downloaded.current = 0;
      totalSize.current = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            totalSize.current = event.data.contentLength ?? 0;
            setDownloadProgress(0);
            break;
          case "Progress":
            downloaded.current += event.data.chunkLength;
            if (totalSize.current > 0) {
              setDownloadProgress(
                Math.min(
                  99,
                  Math.round((downloaded.current / totalSize.current) * 100)
                )
              );
            }
            break;
          case "Finished":
            setDownloadProgress(100);
            break;
        }
      });

      await relaunch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
      setDownloading(false);
    }
  }

  return (
    <section className="stage-enter mx-auto flex max-w-lg flex-col gap-8 px-8 pb-16 pt-10 md:px-12">
      <div>
        <Link
          to="/settings"
          className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t("common.back")}
        </Link>
        <h1 className="font-display text-4xl text-foreground md:text-5xl">
          {t("update.title")}
        </h1>
      </div>

      <div
        className="space-y-5 border border-border p-6 backdrop-blur-md"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-muted-foreground">
            {t("update.currentVersion")}
          </span>
          <span className="font-mono text-foreground">
            {currentVersion ? `v${currentVersion}` : "—"}
          </span>
        </div>

        {status === "available" && update && (
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-muted-foreground">
              {t("update.availableVersion")}
            </span>
            <span className="font-mono text-[var(--stage-accent)]">
              {update.version}
            </span>
          </div>
        )}

        <div className="border-t border-border pt-4">
          {status === "checking" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="size-4 animate-spin" />
              {t("update.checking")}
            </div>
          )}
          {status === "up-to-date" && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="size-4" />
              {t("update.upToDate")}
            </div>
          )}
          {status === "available" && update && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-[var(--stage-accent)]">
                <AlertCircle className="size-4" />
                {t("update.available")}: {update.version}
              </div>
              {update.body && (
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                  {update.body}
                </p>
              )}
            </div>
          )}
          {status === "error" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="size-4" />
                {t("update.checkFailed")}
              </div>
              {error && (
                <p className="break-all font-mono text-xs text-destructive/80">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {downloading && (
          <div className="space-y-2">
            <div className="h-1 overflow-hidden bg-border">
              <div
                className="h-full bg-[var(--stage-accent)] transition-[width]"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {t("update.downloading")} {downloadProgress}%
            </p>
          </div>
        )}

        {status === "available" ? (
          <button
            type="button"
            className="cta-launch w-full"
            onClick={() => void downloadAndInstall()}
            disabled={downloading}
          >
            <Download className="size-4" />
            {downloading ? t("update.installing") : t("update.installButton")}
          </button>
        ) : (
          <button
            type="button"
            className="cta-ghost w-full justify-center"
            onClick={() => void runCheck()}
            disabled={status === "checking"}
          >
            <RefreshCw
              className={`size-4 ${status === "checking" ? "animate-spin" : ""}`}
            />
            {t("update.checkButton")}
          </button>
        )}
      </div>
    </section>
  );
}
