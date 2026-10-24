"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { isNativeApp } from "@/lib/native";

/** Fired on `window` when the member pulls the page down; cards with their own refresh (the sleep sync) listen for it. */
export const PULL_REFRESH_EVENT = "ng:pull-refresh";
const THRESHOLD_PX = 72;

/**
 * Pull-to-refresh for the phone app only (a browser has its own gesture): pulling down from the top of the page past
 * the threshold refreshes the server data and announces the pull to any card that syncs from the device.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef<number | null>(null);
  useEffect(() => {
    if (!isNativeApp()) return;
    const onStart = (e: TouchEvent) => {
      startY.current = window.scrollY <= 0 ? (e.touches[0]?.clientY ?? null) : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null || busy) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      setPull(dy > 0 ? Math.min(dy * 0.5, THRESHOLD_PX * 1.5) : 0);
    };
    const onEnd = () => {
      const reached = pull >= THRESHOLD_PX;
      startY.current = null;
      setPull(0);
      if (!reached || busy) return;
      setBusy(true);
      window.dispatchEvent(new CustomEvent(PULL_REFRESH_EVENT));
      router.refresh();
      window.setTimeout(() => setBusy(false), 1200);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pull, busy, router]);
  return (
    <div>
      {(pull > 0 || busy) && (
        <div className="flex justify-center overflow-hidden transition-[height]" style={{ height: busy ? 40 : pull }} aria-hidden={!busy}>
          <Loader2 className={busy ? "size-5 animate-spin text-gold" : "size-5 text-muted-foreground"} style={busy ? undefined : { opacity: Math.min(1, pull / THRESHOLD_PX), transform: `rotate(${pull * 3}deg)` }} aria-hidden />
          {busy && <span className="sr-only">Refreshing</span>}
        </div>
      )}
      {children}
    </div>
  );
}
