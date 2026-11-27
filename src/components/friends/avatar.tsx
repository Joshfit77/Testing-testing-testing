import { initials } from "@/lib/domain/friends";
import { cn } from "@/lib/utils";

/** A round badge with a member's initials (no photos are shared between members). */
export function Avatar({ name, size = "md", className }: { name: string; size?: "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-gold/50 bg-gold/10 font-display font-bold text-gold-highlight",
        size === "lg" ? "size-16 text-xl" : "size-11 text-sm",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
