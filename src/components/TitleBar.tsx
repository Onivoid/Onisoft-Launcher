import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Minus, Square, X, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWindow } from "@/composables";
import { useApps } from "@/composables/useApps";
import { APP_NAME } from "@/constants";
import { localized } from "@/lib/i18n-text";

export function TitleBar() {
  const { t, i18n } = useTranslation();
  const { minimize, toggleMaximize, close, isMaximized } = useWindow();
  const { apps } = useApps();
  const { appId } = useParams();
  const location = useLocation();
  const [maximized, setMaximized] = useState(false);
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";

  useEffect(() => {
    isMaximized().then(setMaximized).catch(() => undefined);
  }, [isMaximized]);

  const onToggleMaximize = async () => {
    await toggleMaximize();
    setMaximized(await isMaximized());
  };

  let title = APP_NAME;
  if (location.pathname.startsWith("/settings")) {
    title = t("settings.title");
  } else if (location.pathname.startsWith("/update")) {
    title = t("update.title");
  } else if (appId) {
    const app = apps.find((a) => a.id === appId);
    if (app) title = localized(app.manifest.name, lang);
  }

  return (
    <header
      className="shell-enter-bar absolute inset-x-0 top-0 z-50 flex h-[var(--titlebar-h)] items-center justify-between gap-4 px-3"
      data-tauri-drag-region
      onDoubleClick={() => {
        void onToggleMaximize();
      }}
    >
      <p className="pointer-events-none truncate pl-1 text-xs font-medium text-muted-foreground">
        {title}
      </p>
      <div className="no-drag flex items-center">
        <button
          type="button"
          aria-label={t("titlebar.minimize")}
          className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors duration-[var(--dur-fast)] hover:bg-foreground/10 hover:text-foreground"
          onClick={() => void minimize()}
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={maximized ? t("titlebar.restore") : t("titlebar.maximize")}
          className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors duration-[var(--dur-fast)] hover:bg-foreground/10 hover:text-foreground"
          onClick={() => void onToggleMaximize()}
        >
          {maximized ? <Copy className="size-3" /> : <Square className="size-3" />}
        </button>
        <button
          type="button"
          aria-label={t("titlebar.close")}
          className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors duration-[var(--dur-fast)] hover:bg-[#e81123] hover:text-white"
          onClick={() => void close()}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </header>
  );
}
