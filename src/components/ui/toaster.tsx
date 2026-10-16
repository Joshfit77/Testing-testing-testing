"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
  leaving: boolean;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function dismiss(id: number) {
  items = items.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 200);
}

function push(tone: Tone, message: string, ms = 3500) {
  if (!message) return;
  // Avoid stacking the same message twice (e.g. a double-submit).
  if (items.some((t) => t.message === message && !t.leaving)) return;
  const id = nextId++;
  items = [...items.slice(-2), { id, tone, message, leaving: false }];
  emit();
  setTimeout(() => dismiss(id), ms);
}

/** Small pop-up notifications. Safe to call from any client component. */
export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message, 5000),
  info: (message: string) => push("info", message),
};

const ICONS = { success: CheckCircle2, error: TriangleAlert, info: Info } as const;

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => items,
  );
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6 md:left-auto md:right-6 md:items-end"
    >
      {list.map((t) => {
        const Icon = ICONS[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-[#151515]/95 px-4 py-3 text-sm shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)] backdrop-blur-xl",
              t.tone === "success" && "border-gold-muted/70",
              t.tone === "error" && "border-[#7a3434]",
              t.tone === "info" && "border-border",
              t.leaving ? "animate-toast-out" : "animate-toast-in",
            )}
          >
            <Icon className={cn("mt-0.5 size-5 shrink-0", t.tone === "success" ? "text-gold" : t.tone === "error" ? "text-[#f08a8a]" : "text-muted-foreground")} aria-hidden />
            <p className="flex-1 leading-snug">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} className="-m-1 rounded-lg p-1 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Fire a toast once when an action result changes (keyed by its timestamp). */
export function useActionToast(state: { ok: boolean; message?: string; at?: number }, opts: { errors?: boolean } = {}) {
  const [seen, setSeen] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!state.message || state.at === undefined || state.at === seen) return;
    setSeen(state.at);
    if (state.ok) toast.success(state.message);
    else if (opts.errors) toast.error(state.message);
  }, [state, seen, opts.errors]);
}
