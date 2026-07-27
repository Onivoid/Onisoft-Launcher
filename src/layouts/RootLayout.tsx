import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import { useTheme } from "@/composables";
import { Updater } from "@/components/Updater";
import { TitleBar } from "@/components/TitleBar";
import { AppDock } from "@/components/AppDock";
import { StageBackdrop } from "@/components/bits/StageBackdrop";
import { SplashScreen } from "@/components/SplashScreen";
import { AppsProvider, useApps } from "@/composables/useApps";

function Shell() {
  useTheme();
  const { apps, accent, setAccent, loading } = useApps();
  const { appId } = useParams();
  const location = useLocation();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (appId) {
      const app = apps.find((a) => a.id === appId);
      if (app) {
        setAccent(app.manifest.branding.primaryColor);
        return;
      }
    }
    setAccent("#6a6dfb");
  }, [appId, apps, location.pathname, setAccent]);

  const onSplashDone = useCallback(() => setSplashDone(true), []);

  const hideDock =
    location.pathname.startsWith("/settings") ||
    location.pathname.startsWith("/update");

  return (
    <div className="relative h-full overflow-hidden bg-background text-foreground">
      <SplashScreen ready={!loading} onDone={onSplashDone} />
      <StageBackdrop color={accent} />
      {/* Full-window readability wash — must cover titlebar band too (no horizontal seam). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{ background: "var(--hero-scrim)" }}
      />
      <div
        className={`absolute inset-0 z-10 transition-opacity duration-[var(--dur-med)] ${
          splashDone ? "opacity-100" : "opacity-0"
        }`}
      >
        <TitleBar />
        <main
          className={`relative z-10 flex h-full flex-col overflow-y-auto ${
            hideDock ? "pb-8" : "pb-[calc(var(--dock-h)+1.5rem)]"
          } pt-[var(--titlebar-h)]`}
        >
          <Outlet />
        </main>
        {!hideDock && <AppDock apps={apps} accent={accent} />}
      </div>
      <Updater />
    </div>
  );
}

export default function RootLayout() {
  return (
    <AppsProvider>
      <Shell />
    </AppsProvider>
  );
}
