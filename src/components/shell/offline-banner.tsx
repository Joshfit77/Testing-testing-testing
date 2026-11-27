"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    // A missed "online" event (phone asleep, app in the background) would leave the banner up: re-check on return.
    const onVisible = () => document.visibilityState === "visible" && update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-[#2a2310] px-4 py-2 text-xs font-medium text-gold-highlight">
      <WifiOff className="size-4" aria-hidden />
      {/* Only what really is kept offline (workout sets, GPS runs, journey check-ins); food and water need a connection. */}
      <span>
        You&apos;re offline. Workouts, runs and reading-journey check-ins are kept on this phone and sync when you reconnect. Food and
        water can&apos;t be logged until you&apos;re back online.
      </span>
    </div>
  );
}
