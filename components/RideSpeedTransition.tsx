"use client";

import { useEffect, useRef } from "react";
import { LogoMark } from "./brand/Logo";

type Props = {
  onCovered: () => void;
  onComplete: () => void;
};

export function RideSpeedTransition({ onCovered, onComplete }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const animations: Animation[] = [];
    let disposed = false;
    let covered = false;
    let completed = false;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const reveal = () => {
      if (disposed || covered) return;
      covered = true;
      onCovered();
    };
    const finish = () => {
      if (disposed || completed) return;
      completed = true;
      clearTimeout(fallback);
      reveal();
      onComplete();
    };
    const hidden = () => { if (document.visibilityState !== "visible") finish(); };
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChanged = () => { if (motion.matches) finish(); };
    document.addEventListener("pause", finish);
    document.addEventListener("visibilitychange", hidden);
    motion.addEventListener("change", motionChanged);

    try {
      if (motion.matches) finish();
      else {
        const fade = overlay.animate([
          { opacity: 0, offset: 0 },
          { opacity: 1, offset: .08 },
          { opacity: 1, offset: .82 },
          { opacity: 0, offset: 1 },
        ], { duration: 1200, easing: "linear", fill: "both" });
        animations.push(fade);
        const mark = overlay.querySelector<HTMLElement>(".ss-ride-speed-transition__mark")!;
        animations.push(mark.animate([
          { opacity: 0, transform: "scale(.94)" },
          { opacity: 1, transform: "scale(1)" },
        ], { duration: 240, delay: 80, easing: "ease-out", fill: "both" }));
        const slash = [...overlay.querySelectorAll<SVGPathElement>(".ss-ride-speed-transition__slash path")].map(path =>
          path.animate([
            { strokeDashoffset: "1", opacity: 0, offset: 0 },
            { strokeDashoffset: ".999", opacity: 1, offset: .01 },
            { strokeDashoffset: "0", opacity: 1, offset: 1 },
          ], { duration: 420, delay: 360, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" }),
        );
        animations.push(...slash);
        // Resize the existing live map while the finished mark covers it.
        void Promise.all(slash.map(animation => animation.finished)).then(reveal).catch(() => {});
        void fade.finished.then(finish).catch(() => {});
        fallback = setTimeout(finish, 1500);
      }
    } catch {
      // A device that cannot animate can still enter the expanded ride view.
      finish();
    }

    return () => {
      disposed = true;
      clearTimeout(fallback);
      animations.forEach(animation => animation.cancel());
      document.removeEventListener("pause", finish);
      document.removeEventListener("visibilitychange", hidden);
      motion.removeEventListener("change", motionChanged);
    };
  }, [onCovered, onComplete]);

  return <div className="ss-ride-speed-transition" ref={overlayRef} role="status" aria-live="polite">
    <span className="ss-ride-speed-transition__status">Opening speedometer view</span>
    <div className="ss-ride-speed-transition__mark" aria-hidden="true">
      <LogoMark height="100%" width="100%" />
      <svg className="ss-ride-speed-transition__slash" viewBox="8 16 48 32" fill="none" aria-hidden="true">
        <path d="M15.4 49.5 51.7 14.2" pathLength="1" stroke="#000" strokeWidth="5" strokeLinecap="round" />
        <path d="M15.4 49.5 51.7 14.2" pathLength="1" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    </div>
  </div>;
}
