"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#E6C76E", "#C9A54C", "#8C7139", "#FFFFFF", "#F3E2A9"];

/**
 * A one-shot gold confetti burst for big moments (new PRs, finished challenges).
 * Draws on a fixed, non-interactive canvas and removes itself; skipped for reduced motion.
 */
export function Celebration({ fire = true, pieces = 120 }: { fire?: boolean; pieces?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire) return;
    if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (document.documentElement.dataset.motion === "reduce") return; // in-app "Reduce motion" setting
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    const parts = Array.from({ length: pieces }, (_, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 7 + Math.random() * 9;
      return {
        x: w / 2 + (Math.random() - 0.5) * 80,
        y: h * 0.62,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[i % COLORS.length]!,
      };
    });
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, w, h);
      const fade = Math.max(0, 1 - Math.max(0, frame - 70) / 50);
      for (const p of parts) {
        p.vy += 0.28;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (fade > 0) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire, pieces]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[80] h-full w-full" />;
}
