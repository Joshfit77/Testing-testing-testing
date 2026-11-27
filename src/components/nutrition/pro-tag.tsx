import { cn } from "@/lib/utils";

/**
 * A small "Pro" tag on a Food tool the member's plan doesn't include, so the lock screen isn't a surprise.
 * Labelling only: each tool still checks the plan on the server.
 */
export function ProTag({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center rounded-full border border-gold-muted/70 px-2 py-0.5 text-xs font-semibold leading-none text-gold", className)}
      data-testid="pro-tag"
    >
      Pro
    </span>
  );
}
