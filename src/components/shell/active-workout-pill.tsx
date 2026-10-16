"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { DRAFT_EVENT, loadLocalDraft } from "@/lib/workout-storage";

/** Floating shortcut back to an in-progress workout restored from local storage. */
export function ActiveWorkoutPill({ userId }: { userId: string }) {
  const pathname = usePathname();
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

  if (!name || pathname.startsWith("/train/workout")) return null;
  return (
    <Link
      href="/train/workout"
      className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-gold-muted bg-[#141210] px-4 py-2.5 text-sm font-semibold text-gold-highlight shadow-[0_10px_30px_-10px_rgba(201,165,76,0.6)] md:bottom-6"
    >
      <Timer className="size-4 animate-pulse" aria-hidden />
      Resume: <span className="max-w-40 truncate text-foreground">{name}</span>
    </Link>
  );
}
