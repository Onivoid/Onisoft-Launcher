import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { useLanguage, useTheme } from "@/composables";
import { useApps } from "@/composables/useApps";
import { clearManifestCache } from "@/lib/apps";

export default function Settings() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { currentLanguage, changeLanguage } = useLanguage();
  const { refresh, reload } = useApps();

  return (
    <section className="stage-enter mx-auto flex max-w-xl flex-col gap-10 px-8 pb-16 pt-10 md:px-12">
      <div>
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t("common.back")}
        </Link>
        <h1 className="font-display text-4xl text-foreground md:text-5xl">
          {t("settings.title")}
        </h1>
        <p className="mt-3 text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("settings.theme.title")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {(["light", "dark", "system"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`cta-ghost ${theme === value ? "is-selected" : ""}`}
              onClick={() => setTheme(value)}
            >
              {t(`settings.theme.${value}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("settings.language.title")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`cta-ghost ${currentLanguage === "fr" ? "is-selected" : ""}`}
            onClick={() => void changeLanguage("fr")}
          >
            {t("settings.language.fr")}
          </button>
          <button
            type="button"
            className={`cta-ghost ${currentLanguage === "en" ? "is-selected" : ""}`}
            onClick={() => void changeLanguage("en")}
          >
            {t("settings.language.en")}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("settings.catalog.title")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="cta-ghost" onClick={() => void refresh()}>
            {t("settings.catalog.refresh")}
          </button>
          <button
            type="button"
            className="cta-ghost"
            onClick={async () => {
              await clearManifestCache();
              await reload();
            }}
          >
            {t("settings.catalog.clearCache")}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("settings.updates.title")}
        </h2>
        <Link to="/update" className="cta-ghost inline-flex">
          {t("settings.updates.check")}
        </Link>
      </section>
    </section>
  );
}
