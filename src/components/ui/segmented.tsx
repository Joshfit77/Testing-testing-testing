import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SegmentedItem {
  key: string;
  label: React.ReactNode;
  /** A link item navigates; a button item calls onSelect. */
  href?: string;
  active: boolean;
  disabled?: boolean;
  testId?: string;
}

/**
 * A row of pills in a dark track with the active one filled gold: the period picker on Progress, the technique tabs
 * of a demonstration, the Bible / Prayer / Plans switch on Faith, the category filter on Programs.
 * Links get aria-current; buttons get role="tab" + aria-selected when `tabs` is set, else aria-pressed.
 */
export function Segmented({
  items,
  onSelect,
  label,
  tabs = false,
  className,
  size = "md",
}: {
  items: SegmentedItem[];
  onSelect?: (key: string) => void;
  label: string;
  tabs?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const pill = (active: boolean, disabled?: boolean) =>
    cn(
      "flex min-w-0 flex-1 items-center justify-center rounded-full px-3 text-center font-semibold transition-colors",
      size === "sm" ? "min-h-9 text-sm" : "min-h-11 text-[0.9375rem]",
      active ? "bg-gold-gradient text-black shadow-bronze" : "text-foreground/85 hover:text-foreground",
      disabled && "opacity-50",
    );
  return (
    <div role={tabs ? "tablist" : "group"} aria-label={label} className={cn("flex gap-1 rounded-full border border-border bg-[#101010] p-1", className)}>
      {items.map((it) =>
        it.href ? (
          <Link key={it.key} href={it.href} aria-current={it.active ? "page" : undefined} className={pill(it.active)} data-testid={it.testId}>
            {it.label}
          </Link>
        ) : (
          <button
            key={it.key}
            type="button"
            role={tabs ? "tab" : undefined}
            aria-selected={tabs ? it.active : undefined}
            aria-pressed={tabs ? undefined : it.active}
            disabled={it.disabled}
            onClick={() => onSelect?.(it.key)}
            className={pill(it.active, it.disabled)}
            data-testid={it.testId}
          >
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}
