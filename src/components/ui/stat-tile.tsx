import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A charcoal tile with a gold icon, a small label and a large value (the workout totals, the Home recovery and progress tiles). */
export function StatTile({
  icon: Icon,
  label,
  value,
  tone = "default",
  className,
  testId,
  href,
}: {
  icon?: LucideIcon;
  label: React.ReactNode;
  value: React.ReactNode;
  /** "default": white value; "good": green value (recovery ready, a rise); "gold": gold value. */
  tone?: "default" | "good" | "gold";
  className?: string;
  testId?: string;
  href?: string;
}) {
  const body = (
    <>
      {Icon && <Icon className="size-7 shrink-0 text-gold" strokeWidth={2} aria-hidden />}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "block truncate font-display text-[1.375rem] font-bold leading-tight tabular-nums",
            tone === "good" ? "text-[#58d68d]" : tone === "gold" ? "text-gold-highlight" : "text-foreground",
          )}
        >
          {value}
        </span>
      </span>
    </>
  );
  const cls = cn("flex min-h-[4.5rem] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3", href && "hover:border-gold-muted", className);
  if (href) {
    return (
      <Link href={href} className={cls} data-testid={testId}>
        {body}
      </Link>
    );
  }
  return (
    <div className={cls} data-testid={testId}>
      {body}
    </div>
  );
}
