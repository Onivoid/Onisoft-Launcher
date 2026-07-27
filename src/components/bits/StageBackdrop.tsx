import { useEffect, useId, useMemo } from "react";

type StageBackdropProps = {
  color?: string;
  className?: string;
};

/** Living atelier stage — accent-tinted wash, readable in dark & light. */
export function StageBackdrop({ color = "#6a6dfb", className = "" }: StageBackdropProps) {
  const uid = useId().replace(/:/g, "");
  const soft = useMemo(() => color, [color]);

  useEffect(() => {
    document.documentElement.style.setProperty("--stage-accent", soft);
  }, [soft]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ background: "var(--stage-bg)" }}
    >
      <div
        className="absolute inset-0 transition-[background] duration-[var(--dur-slow)]"
        style={{
          background: `
            radial-gradient(ellipse 90% 70% at 72% 28%, color-mix(in oklab, ${soft} 55%, transparent) 0%, transparent 60%),
            radial-gradient(ellipse 60% 52% at 12% 78%, color-mix(in oklab, ${soft} 40%, transparent) 0%, transparent 55%),
            radial-gradient(ellipse 48% 40% at 48% 52%, color-mix(in oklab, ${soft} 22%, transparent) 0%, transparent 68%),
            var(--stage-bg)
          `,
        }}
      />

      <div
        className="stage-sweep absolute -left-[25%] top-[-20%] h-[140%] w-[60%] opacity-85 blur-2xl"
        style={{
          background: `linear-gradient(108deg, transparent 12%, color-mix(in oklab, ${soft} 70%, transparent) 48%, transparent 82%)`,
        }}
      />

      <div
        className="stage-orb absolute right-[4%] top-[10%] size-[52vmin] rounded-full opacity-70 blur-3xl"
        style={{ background: soft }}
      />
      <div
        className="stage-orb-alt absolute bottom-[4%] left-[2%] size-[42vmin] rounded-full opacity-55 blur-3xl"
        style={{ background: soft }}
      />

      <div
        className="stage-grid absolute inset-0 opacity-100"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--stage-grid) 1px, transparent 1px),
            linear-gradient(to bottom, var(--stage-grid) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at 55% 40%, black 18%, transparent 75%)",
        }}
      />

      <svg className="absolute inset-0 h-full w-full opacity-[0.1] mix-blend-overlay">
        <filter id={`noise-${uid}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="2"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter={`url(#noise-${uid})`} />
      </svg>

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 28%, var(--stage-fog) 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-56"
        style={{
          background:
            "linear-gradient(to top, var(--fog) 0%, transparent 100%)",
        }}
      />

      <style>{`
        @keyframes stage-sweep {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-2deg); }
          50% { transform: translate3d(22%, 10%, 0) rotate(5deg); }
        }
        @keyframes stage-orb {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.55; }
          50% { transform: translate3d(-10%, 12%, 0) scale(1.22); opacity: 0.85; }
        }
        @keyframes stage-orb-alt {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1.1); opacity: 0.4; }
          50% { transform: translate3d(14%, -10%, 0) scale(0.92); opacity: 0.7; }
        }
        @keyframes stage-grid-drift {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(22px, -16px, 0); }
        }
        .stage-sweep { animation: stage-sweep 7s var(--ease-in-out) infinite; }
        .stage-orb { animation: stage-orb 6.5s var(--ease-in-out) infinite; }
        .stage-orb-alt { animation: stage-orb-alt 8s var(--ease-in-out) infinite; }
        .stage-grid { animation: stage-grid-drift 12s var(--ease-in-out) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .stage-sweep, .stage-orb, .stage-orb-alt, .stage-grid { animation: none; }
        }
      `}</style>
    </div>
  );
}
