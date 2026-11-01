"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { DRAFT_EVENT, loadLocalDraft, retryPendingDiscards } from "@/lib/workout-storage";
import { discardWorkoutAction } from "@/server/actions/workouts";

/** Floating shortcut back to an in-progress workout restored from local storage. */
export function ActiveWorkoutPill({ userId }: { userId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setName(loadLocalDraft(userId)?.name ?? null);
    refresh();
    window.addEventListener(DRAFT_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(DRAFT_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [userId]);

  // A workout discarded while offline still has its server copy: delete it once the device is online again, then
  // refresh so Home and Train stop offering "Resume workout" for it.
  useEffect(() => {
    const retry = () => {
      if (!navigator.onLine) return;
      void retryPendingDiscards(userId, discardWorkoutAction).then((removed) => {
        if (removed) router.refresh();
      });
    };
    retry();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [userId, router]);

  if (!name || pathname.startsWith("/train/workout")) return null;
  return (
    <Link
      href="/train/workout"
      data-hide-with-keyboard
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-gold-muted bg-card px-4 py-2.5 text-sm font-semibold text-gold-highlight shadow-[0_10px_30px_-10px_rgba(201,165,76,0.6)] md:bottom-6"
    >
      <Timer className="size-4 animate-pulse" aria-hidden />
      Resume: <span className="max-w-40 truncate text-foreground">{name}</span>
    </Link>
  );
}
