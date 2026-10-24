import { useId } from "react";
import { cn } from "@/lib/utils";

/** Narrow Gate mark: an arched gate with a narrow opening. Original artwork. */
export function LogoMark({ className }: { className?: string }) {
  // Unique gradient id per instance: a duplicate id inside a hidden (display:none) copy breaks the fill.
  const gid = `ngf-gold-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn("size-9", className)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F1DFA8" />
          <stop offset="55%" stopColor="#C9A54C" />
          <stop offset="100%" stopColor="#8C6A2F" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="12" fill="#151515" stroke="#2B2824" />
      <path d="M12 38V20a12 12 0 0 1 24 0v18" fill="none" stroke={`url(#${gid})`} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M21 38V24a3 3 0 0 1 6 0v14" fill={`url(#${gid})`} />
      <path d="M9 38h30" stroke={`url(#${gid})`} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="flex flex-col whitespace-nowrap leading-none">
          <span className="font-serif text-lg font-semibold uppercase tracking-[0.14em] text-gold-gradient">Narrow Gate</span>
          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.42em] text-muted-foreground">Fitness</span>
        </span>
      )}
    </span>
  );
}
