import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useApps } from "@/composables/useApps";
import { APP_NAME } from "@/constants";
import { localized } from "@/lib/i18n-text";
import { appStatusKey } from "@/lib/app-status";

const LAST_APP_KEY = "onisoft-last-app";

export default function Home() {
  const { t, i18n } = useTranslation();
  const { apps, loading, error } = useApps();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";
  const catalogReady = !loading && apps.length > 0;

  return (
    <section
      key="home"
      className="stage-enter relative flex min-h-full flex-1 flex-col justify-end px-8 pb-10 pt-16 md:px-14 md:pb-14"
    >
      <div className="relative z-10 flex max-w-4xl flex-col gap-10">
        <div>
          <img
            src="/Onisoft.png"
            alt=""
            className="mb-6 h-16 w-auto drop-shadow-xl md:h-20"
          />
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t("home.eyebrow")}
          </p>
          <h1 className="font-display text-5xl text-foreground md:text-6xl lg:text-7xl">
            {APP_NAME}
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
            {t("home.subtitle")}
          </p>
          {catalogReady && (
            <p className="mt-3 text-sm text-muted-foreground/80">
              {t("home.catalogStatus", { count: apps.length })}
            </p>
          )}
          {loading && (
            <p className="mt-3 text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {error && (
            <p className="mt-3 text-sm text-destructive">
              {t("common.error")}: {error}
            </p>
          )}
        </div>

        {apps.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-2xl text-foreground md:text-3xl">
                  {t("home.appsHeading")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("home.libraryHint")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {apps.map((app) => {
                const status = appStatusKey(app);
                return (
                  <Link
                    key={app.id}
                    to={`/app/${app.id}`}
                    className="app-tile no-drag"
                    onClick={() => {
                      try {
                        localStorage.setItem(LAST_APP_KEY, app.id);
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    <img
                      src={app.manifest.branding.logo}
                      alt=""
                      className="size-11 shrink-0 object-contain"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-foreground">
                        {localized(app.manifest.name, lang)}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {t(`app.status.${status}`)}
                        {app.remoteVersion ? ` · v${app.remoteVersion}` : ""}
                      </span>
                    </span>
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: app.manifest.branding.primaryColor }}
                      aria-hidden
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
