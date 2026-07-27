import { useEffect, useState } from "react";
import { APP_NAME } from "@/constants";

const SESSION_KEY = "onisoft-splash-done";
const MIN_MS = 700;
const MAX_MS = 1200;

type SplashScreenProps = {
  ready: boolean;
  onDone: () => void;
};

export function SplashScreen({ ready, onDone }: SplashScreenProps) {
  const [visible, setVisible] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [exiting, setExiting] = useState(false);
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!visible) {
      onDone();
      return;
    }

    const finish = () => {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
      setExiting(true);
      window.setTimeout(() => {
        setVisible(false);
        onDone();
      }, 320);
    };

    const elapsed = Date.now() - mountedAt;
    const waitMin = Math.max(0, MIN_MS - elapsed);
    const maxTimer = window.setTimeout(finish, MAX_MS);

    let minTimer: number | undefined;
    if (ready) {
      minTimer = window.setTimeout(finish, waitMin);
    }

    return () => {
      window.clearTimeout(maxTimer);
      if (minTimer) window.clearTimeout(minTimer);
    };
  }, [ready, visible, mountedAt, onDone]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-[320ms] ${
        exiting ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ background: "var(--stage-bg)" }}
      role="presentation"
      onClick={() => {
        try {
          sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          /* ignore */
        }
        setExiting(true);
        window.setTimeout(() => {
          setVisible(false);
          onDone();
        }, 200);
      }}
    >
      <div
        className="splash-logo flex flex-col items-center gap-5"
        style={{ color: "var(--foreground)" }}
      >
        <img
          src="/Onisoft.png"
          alt=""
          className="h-20 w-auto drop-shadow-xl md:h-24"
        />
        <p
          className="font-display text-2xl tracking-tight md:text-3xl"
          style={{ color: "var(--foreground)" }}
        >
          {APP_NAME}
        </p>
        <span
          className="h-1 w-12 rounded-full"
          style={{ background: "var(--brand)" }}
        />
      </div>
      <style>{`
        .splash-logo {
          animation: splash-in 520ms var(--ease-out) both;
        }
        @keyframes splash-in {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .splash-logo { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
