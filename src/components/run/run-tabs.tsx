import Link from "next/link";
import { cn } from "@/lib/utils";

export type RunTab = "outdoor" | "log" | "history";
export const RUN_TABS: { id: RunTab; label: string }[] = [
  { id: "outdoor", label: "Outdoor Run" },
  { id: "log", label: "Treadmill / Manual" },
  { id: "history", label: "History" },
];

export function parseRunTab(v: string | undefined): RunTab {
  return RUN_TABS.some((t) => t.id === v) ? (v as RunTab) : "outdoor";
}

/** Segmented control for the Run hub. Each segment is a real link, so Back and reload keep the tab. */
export function RunTabs({ active }: { active: RunTab }) {
  return (
    <nav aria-label="Run sections" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1">
      {RUN_TABS.map((t) => (
        <Link
          key={t.id}
          href={t.id === "outdoor" ? "/run" : `/run?tab=${t.id}`}
          scroll={false}
          aria-current={active === t.id ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center justify-center rounded-lg px-1 text-center text-[0.8125rem] font-semibold leading-tight transition-colors",
            active === t.id ? "bg-gold-gradient text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
