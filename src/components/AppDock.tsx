import type { CSSProperties, ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppSummary } from "@/types/apps";
import { ROUTES } from "@/constants";
import { localized } from "@/lib/i18n-text";
import { appNeedsUpdate, appStatusKey } from "@/lib/app-status";

type AppDockProps = {
  apps: AppSummary[];
  accent: string;
};

export function AppDock({ apps, accent }: AppDockProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("fr") ? "fr" : "en";

  return (
    <footer
      className="shell-enter-dock pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 pt-2"
      aria-label={t("nav.library")}
    >
      <nav
        className="dock-shell pointer-events-auto no-drag flex max-w-[min(920px,100%)] items-center gap-1 px-3 py-3"
        style={{ "--dock-accent": accent } as CSSProperties}
      >
        <DockItem to={ROUTES.HOME} end label={t("nav.home")} accent="var(--brand)">
          {({ isActive }) => (
            <span
              className={`dock-well ${isActive ? "is-active" : ""}`}
              style={
                isActive
                  ? {
                      background:
                        "color-mix(in oklab, var(--brand) 18%, var(--surface-elevated))",
                      boxShadow:
                        "0 0 0 1px color-mix(in oklab, var(--brand) 35%, transparent)",
                    }
                  : undefined
              }
            >
              <img
                src="/Onisoft.png"
                alt=""
                className="size-7 object-contain md:size-8"
              />
            </span>
          )}
        </DockItem>

        <span
          className="dock-divider mx-1 hidden h-8 w-px sm:block"
          aria-hidden
        />

        <div className="dock-apps flex min-w-0 items-center gap-1 px-0.5">
          {apps.map((app) => {
            const name = localized(app.manifest.name, lang);
            const update = appNeedsUpdate(app);
            const color = app.manifest.branding.primaryColor;

            return (
              <DockItem
                key={app.id}
                to={`/app/${app.id}`}
                label={name}
                accent={color}
                badge={update}
                badgeLabel={
                  update ? `${name} — ${t("app.status.updateAvailable")}` : name
                }
                onNavigate={() => {
                  try {
                    localStorage.setItem("onisoft-last-app", app.id);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {({ isActive }) => (
                  <span
                    className={`dock-well ${isActive ? "is-active" : ""}`}
                    style={
                      isActive
                        ? {
                            background: `color-mix(in oklab, ${color} 20%, var(--surface-elevated))`,
                            boxShadow: `0 0 0 1px color-mix(in oklab, ${color} 40%, transparent), 0 8px 24px color-mix(in oklab, ${color} 22%, transparent)`,
                          }
                        : undefined
                    }
                  >
                    <img
                      src={app.manifest.branding.logo}
                      alt=""
                      className="relative size-7 object-contain md:size-8"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility =
                          "hidden";
                      }}
                    />
                    <span className="sr-only">
                      {t(`app.status.${appStatusKey(app)}`)}
                    </span>
                  </span>
                )}
              </DockItem>
            );
          })}
        </div>

        <span
          className="dock-divider mx-1 hidden h-8 w-px sm:block"
          aria-hidden
        />

        <DockItem
          to={ROUTES.SETTINGS}
          label={t("nav.settings")}
          accent="var(--brand)"
        >
          {({ isActive }) => (
            <span
              className={`dock-well dock-well-icon ${isActive ? "is-active" : ""}`}
              style={
                isActive
                  ? {
                      background:
                        "color-mix(in oklab, var(--brand) 16%, var(--surface-elevated))",
                      boxShadow:
                        "0 0 0 1px color-mix(in oklab, var(--brand) 30%, transparent)",
                    }
                  : undefined
              }
            >
              <Settings
                className={`size-5 transition-colors ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              />
            </span>
          )}
        </DockItem>
      </nav>
    </footer>
  );
}

type DockItemProps = {
  to: string;
  end?: boolean;
  label: string;
  accent: string;
  badge?: boolean;
  badgeLabel?: string;
  onNavigate?: () => void;
  children: (ctx: { isActive: boolean }) => ReactNode;
};

function DockItem({
  to,
  end,
  label,
  accent,
  badge,
  badgeLabel,
  onNavigate,
  children,
}: DockItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      title={badgeLabel ?? label}
      aria-label={badgeLabel ?? label}
      onClick={onNavigate}
      className="group relative flex w-[4.25rem] shrink-0 flex-col items-center gap-1.5 outline-none"
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            {children({ isActive })}
            {badge && (
              <span
                className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-[var(--surface-elevated)]"
                style={{ background: accent }}
                aria-hidden
              />
            )}
          </span>
          <span
            className={`dock-label max-w-full truncate text-center text-[0.65rem] font-semibold leading-none transition-colors duration-[var(--dur-fast)] ${
              isActive
                ? "text-foreground"
                : "text-muted-foreground/80 group-hover:text-muted-foreground group-focus-visible:text-muted-foreground"
            }`}
          >
            {label}
          </span>
          <span
            className="h-1 w-1 rounded-full transition-transform duration-[var(--dur-med)]"
            style={{
              background: isActive ? accent : "transparent",
              transform: isActive ? "scale(1)" : "scale(0)",
            }}
            aria-hidden
          />
        </>
      )}
    </NavLink>
  );
}
