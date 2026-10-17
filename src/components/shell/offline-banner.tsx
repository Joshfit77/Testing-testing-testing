"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-[#2a2310] px-4 py-2 text-xs font-medium text-gold-highlight">
      <WifiOff className="size-4" aria-hidden />
      You&apos;re offline. An in-progress workout keeps saving on this device and will sync when you reconnect.
    </div>
  );
}
