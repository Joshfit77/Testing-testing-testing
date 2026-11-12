"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { goBackOr } from "@/lib/nav-memory";

/** Returns to the previous screen; falls back to `fallback` when there is no in-app history (e.g. opened directly). */
export function BackButton({ fallback = "/home", label = "Back" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      // Back only when the previous screen is inside the app (window.history.length also counts other sites).
      onClick={() => goBackOr(router, fallback)}
      className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" aria-hidden /> {label}
    </button>
  );
}
