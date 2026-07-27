import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, RefreshCw, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useApps } from "@/composables/useApps";
import { localized } from "@/lib/i18n-text";
import { appIsInstalled, appNeedsUpdate, appStatusKey } from "@/lib/app-status";
import { formatBytes } from "@/lib/format";
import { contrastForeground } from "@/lib/color";
import type { AppInstallDetails } from "@/types/apps";

export default function AppDetail() {
  const { appId } = useParams();
  const { t, i18n } = useTranslation();
  const {
    apps,
    install,
    uninstall,
    launch,
    rediscover,
    fetchDetails,
    downloadingId,
    uninstallingId,
    progress,
    installPhase,
    actionError,
    clearActionError,
  } = useApps();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const app = apps.find((a) => a.id === appId);
  const [details, setDetails] = useState<AppInstallDetails | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState(false);

  useEffect(() => {
    clearActionError();
    setConfirmUninstall(false);
  }, [appId, clearActionError]);

  useEffect(() => {
    if (appId) {
      try {
        localStorage.setItem("onisoft-last-app", appId);
      } catch {
        /* ignore */
      }
    }
  }, [appId]);

  useEffect(() => {
    if (!appId) return;
    let cancelled = false;
    void fetchDetails(appId)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch(() => {
        if (!cancelled) setDetails(null);
      });
    return () => {
      cancelled = true;
    };
  }, [appId, fetchDetails, apps]);

  if (!app) {
    return (
      <p className="px-10 pt-20 text-muted-foreground">{t("app.notFound")}</p>
    );
  }

  const installed = appIsInstalled(app);
  const remote = app.remoteVersion ?? null;
  const local = app.install?.version ?? null;
  const needsUpdate = appNeedsUpdate(app);
  const status = appStatusKey(app);
  const busy = downloadingId === app.id || uninstallingId === app.id;
  const pct =
    busy && installPhase === "downloading" && progress?.total
      ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
      : null;
  const scopedError =
    actionError?.appId === app.id ? actionError.message : null;
  const brand = app.manifest.branding.primaryColor;
  const brandFg = contrastForeground(brand);
  const name = localized(app.manifest.name, lang);

  const phaseLabel =
    installPhase === "installing"
      ? t("app.installingPhase")
      : installPhase === "locating"
        ? t("app.locatingPhase")
        : installPhase === "uninstalling"
          ? t("app.uninstallingPhase")
          : pct != null
            ? `${pct}%`
            : t("app.downloading");

  const barWidth =
    installPhase === "installing" ||
    installPhase === "locating" ||
    installPhase === "uninstalling"
      ? 100
      : (pct ?? 12);

  const primaryLabel = !installed
    ? busy && downloadingId === app.id
      ? t("app.installing")
      : t("app.install")
    : needsUpdate
      ? busy && downloadingId === app.id
        ? t("app.updating")
        : t("app.update")
      : t("app.launch");

  const onPrimary = () => {
    if (!installed || needsUpdate) {
      void install(app.id);
      return;
    }
    void launch(app.id);
  };

  const installedAt = (details?.installedAt ?? app.install?.installedAt)
    ? new Date(
        (details?.installedAt ?? app.install?.installedAt) as string
      ).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const installPath =
    details?.executablePath ?? app.install?.executablePath ?? null;
  const installDir = details?.installDir ?? null;
  const installSize = details?.installSizeBytes ?? null;
  const cacheSize = details?.cacheSizeBytes ?? 0;
  const installKind = details?.kind ?? app.install?.kind ?? null;

  const versionLine = [
    remote ? `${t("app.remoteVersion")} ${remote}` : null,
    local && local !== "unknown" ? `${t("app.localVersion")} ${local}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      key={app.id}
      className="stage-enter relative flex min-h-full flex-1 flex-col justify-end px-8 pb-10 pt-14 md:px-12 md:pb-14 lg:px-16"
      style={{ ["--app-brand" as string]: brand }}
    >
      <div className="relative z-10 grid w-full grid-cols-1 items-end gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:gap-12 xl:gap-16">
        {/* Identité */}
        <div className="app-hero flex min-w-0 flex-col">
          <div className="app-hero-mark" aria-hidden>
            <img src={app.manifest.branding.logo} alt="" />
          </div>

          <p
            className={`status-pill w-fit ${status !== "notInstalled" ? "is-accent" : ""}`}
          >
            {t(`app.status.${status}`)}
          </p>

          <h1 className="app-hero-title font-display text-foreground">
            {name}
          </h1>

          <p className="app-hero-desc text-muted-foreground">
            {localized(app.manifest.description, lang)}
          </p>

          {versionLine && (
            <p className="mt-4 text-sm tracking-wide text-muted-foreground/85">
              {versionLine}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="cta-launch no-drag"
              style={{ background: brand, color: brandFg }}
              disabled={busy}
              onClick={onPrimary}
            >
              {primaryLabel}
            </button>

            {installed && needsUpdate && (
              <button
                type="button"
                className="cta-ghost no-drag"
                disabled={busy}
                onClick={() => void launch(app.id)}
              >
                {t("app.launchAnyway")}
              </button>
            )}

            <button
              type="button"
              className="cta-ghost no-drag"
              disabled={busy}
              onClick={() => void rediscover(app.id)}
            >
              <RefreshCw className="size-3.5" />
              {t("app.detect")}
            </button>

            <a
              href={app.manifest.repo}
              target="_blank"
              rel="noreferrer"
              className="cta-ghost no-drag"
            >
              <ExternalLink className="size-3.5" />
              {t("app.repo")}
            </a>

            {installed && (
              <button
                type="button"
                className="cta-ghost cta-danger no-drag"
                disabled={busy}
                onClick={() => setConfirmUninstall(true)}
              >
                <Trash2 className="size-3.5" />
                {t("app.uninstall")}
              </button>
            )}
          </div>

          {busy && (
            <div className="mt-6 max-w-md space-y-2">
              <div className="h-1 overflow-hidden bg-border">
                <div
                  className="h-full transition-[width] duration-[var(--dur-med)]"
                  style={{
                    width: `${barWidth}%`,
                    background: brand,
                  }}
                />
              </div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground">
                {phaseLabel}
              </p>
            </div>
          )}

          {scopedError && (
            <div className="mt-5 flex max-w-xl items-start gap-3 text-sm text-destructive">
              <p className="flex-1">{scopedError}</p>
              <button
                type="button"
                className="no-drag shrink-0 text-destructive/70 transition hover:text-destructive"
                aria-label={t("common.dismiss")}
                onClick={clearActionError}
              >
                <X className="size-4" />
              </button>
            </div>
          )}
        </div>

        {/* Détails */}
        <aside className="app-detail-panel min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("app.details")}
          </h2>

          <dl className="mt-5 space-y-4">
            {remote && (
              <div className="app-detail-row">
                <dt>{t("app.remoteVersion")}</dt>
                <dd>{t("app.releaseTag", { version: remote })}</dd>
              </div>
            )}

            {(installKind || installedAt) && (
              <div className="app-detail-split">
                {installKind && (
                  <div className="app-detail-row">
                    <dt>{t("app.installKind")}</dt>
                    <dd>{installKind}</dd>
                  </div>
                )}
                {installedAt && (
                  <div className="app-detail-row">
                    <dt>{t("app.installedAt")}</dt>
                    <dd>{installedAt}</dd>
                  </div>
                )}
              </div>
            )}

            {(installSize != null || cacheSize > 0) && (
              <div className="app-detail-split">
                {installSize != null && (
                  <div className="app-detail-row">
                    <dt>{t("app.installSize")}</dt>
                    <dd>{formatBytes(installSize, lang)}</dd>
                  </div>
                )}
                {cacheSize > 0 && (
                  <div className="app-detail-row">
                    <dt>{t("app.cacheSize")}</dt>
                    <dd>{formatBytes(cacheSize, lang)}</dd>
                  </div>
                )}
              </div>
            )}

            {installDir && (
              <div className="app-detail-row">
                <dt>{t("app.installDir")}</dt>
                <dd className="is-path">{installDir}</dd>
              </div>
            )}

            {installPath && (
              <div className="app-detail-row">
                <dt>{t("app.executable")}</dt>
                <dd className="is-path">{installPath}</dd>
              </div>
            )}

            {!installed && (
              <p className="text-sm text-muted-foreground">
                {t("app.detailsNotInstalled")}
              </p>
            )}

            {!remote && !installed && (
              <p className="text-sm text-muted-foreground">
                {t("app.releaseFallback")}
              </p>
            )}

            <div className="app-detail-row">
              <dt>{t("app.manifestSource")}</dt>
              <dd>{app.manifestSource}</dd>
            </div>
          </dl>

          <a
            href={app.manifest.repo}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
          >
            <ExternalLink className="size-3.5" />
            {t("app.viewOnGithub")}
          </a>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmUninstall}
        title={t("app.uninstallTitle", { name })}
        description={t("app.uninstallDescription")}
        confirmLabel={
          uninstallingId === app.id
            ? t("app.uninstalling")
            : t("app.uninstallConfirm")
        }
        cancelLabel={t("common.cancel")}
        danger
        busy={busy}
        onCancel={() => setConfirmUninstall(false)}
        onConfirm={() => {
          setConfirmUninstall(false);
          void uninstall(app.id);
        }}
      />
    </section>
  );
}
