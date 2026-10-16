"use client";

import { useEffect, useRef } from "react";

/**
 * Short exercise demo clip: muted, looping and inline (so iOS doesn't jump to fullscreen), with controls.
 * Autoplays unless the viewer prefers reduced motion.
 */
export function DemoVideo({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    video.muted = true; // React doesn't reliably reflect the muted attribute, which autoplay requires.
    void video.play().catch(() => {
      /* autoplay blocked (e.g. low-power mode) — controls remain available */
    });
  }, [src]);
  return <video ref={ref} src={src} muted loop playsInline controls preload="metadata" className="w-full rounded-xl bg-black" aria-label={label} />;
}
