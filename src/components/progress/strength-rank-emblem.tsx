import { levelLabel } from "@/lib/domain/strength-ranks";
import { cn } from "@/lib/utils";

/** Metal colours per level (1 = Bronze … 6 = Disciple). Shared with the map so the legend and figure match. */
export const RANK_COLORS: Record<number, { base: string; light: string; dark: string }> = {
  1: { base: "#a8693a", light: "#d79a66", dark: "#5e3518" },
  2: { base: "#b9bec6", light: "#eef1f5", dark: "#6c727c" },
  3: { base: "#cfa53e", light: "#f3dc8b", dark: "#7a5a17" },
  4: { base: "#9fc9cc", light: "#e3f5f5", dark: "#4f7f84" },
  5: { base: "#7fb8e6", light: "#d6ecff", dark: "#305f8a" },
  6: { base: "#e2b84a", light: "#fff1b8", dark: "#8a5d10" },
};
export const BELOW_BRONZE_COLOR = "#4a4337";

const SHIELD = "M32,4 L56,12 L56,30 C56,46 46,56 32,61 C18,56 8,46 8,30 L8,12 Z";

/**
 * Original emblems that gain detail with each rank: a plain shield (Bronze), an inner border (Silver), a cross
 * (Gold), laurel (Platinum), a cut gem (Diamond), and for Disciple an ornate gold narrow gate with rays.
 */
export function StrengthRankEmblem({ level, className, title }: { level: number | null; className?: string; title?: string }) {
  const label = title ?? levelLabel(level);
  const lv = level ?? 0;
  const c = lv > 0 ? RANK_COLORS[lv]! : null;
  const id = `rank-${level ?? "na"}`;
  return (
    <svg viewBox="0 0 64 64" className={cn("size-12 shrink-0", className)} role="img" aria-label={label}>
      <title>{label}</title>
      {c ? (
        <>
          <defs>
            <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={c.light} />
              <stop offset="0.45" stopColor={c.base} />
              <stop offset="1" stopColor={c.dark} />
            </linearGradient>
          </defs>
          {lv === 6 && (
            <g stroke={c.light} strokeWidth="1.2" opacity="0.7">
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * Math.PI * 2;
                return <line key={i} x1={32 + Math.cos(a) * 26} y1={33 + Math.sin(a) * 26} x2={32 + Math.cos(a) * 31} y2={33 + Math.sin(a) * 31} />;
              })}
            </g>
          )}
          <path d={SHIELD} fill={`url(#${id}-metal)`} stroke={c.dark} strokeWidth="1.5" />
          {lv >= 2 && <path d="M32,9 L51,15.5 L51,30 C51,43 43,51 32,55.5 C21,51 13,43 13,30 L13,15.5 Z" fill="none" stroke={c.light} strokeWidth="1.2" opacity="0.85" />}
          {lv >= 4 && (
            <g fill="none" stroke={c.dark} strokeWidth="1.4" strokeLinecap="round">
              <path d="M18,44 C14,38 14,30 17,24" />
              <path d="M46,44 C50,38 50,30 47,24" />
              {[26, 31, 36, 41].map((y, i) => (
                <g key={y}>
                  <path d={`M${16 + (i % 2)},${y} l-3,-2`} />
                  <path d={`M${48 - (i % 2)},${y} l3,-2`} />
                </g>
              ))}
            </g>
          )}
          {lv === 3 || lv === 4 ? <path d="M32,20 L32,46 M24,28 L40,28" stroke={c.dark} strokeWidth="3.2" strokeLinecap="round" /> : null}
          {lv === 5 && (
            <g stroke={c.dark} strokeWidth="1.2" fill={c.light}>
              <path d="M24,26 L28,20 L36,20 L40,26 L32,42 Z" />
              <path d="M24,26 L40,26 M28,20 L32,26 L36,20 M32,26 L32,42" fill="none" />
            </g>
          )}
          {lv === 6 && (
            <g>
              {/* The narrow gate: two pillars and an arch, with a narrow lit opening. */}
              <path d="M21,46 L21,27 C21,18 43,18 43,27 L43,46" fill="none" stroke={c.dark} strokeWidth="3" strokeLinejoin="round" />
              <path d="M29,46 L29,30 C29,26.5 35,26.5 35,30 L35,46 Z" fill="#fff8d6" stroke={c.dark} strokeWidth="1.2" />
              <path d="M18,46 L46,46" stroke={c.dark} strokeWidth="2.4" strokeLinecap="round" />
              <path d="M32,12 L32,17 M29.5,14.5 L34.5,14.5" stroke={c.dark} strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="21" cy="26" r="1.6" fill={c.light} />
              <circle cx="43" cy="26" r="1.6" fill={c.light} />
            </g>
          )}
        </>
      ) : (
        <>
          <path d={SHIELD} fill="#171612" stroke={level === 0 ? BELOW_BRONZE_COLOR : "#5b5446"} strokeWidth="1.5" strokeDasharray={level == null ? "4 3" : undefined} />
          <text x="32" y="39" textAnchor="middle" fontSize="18" fontWeight="700" fill="#8f8775">
            {level == null ? "?" : "·"}
          </text>
        </>
      )}
    </svg>
  );
}
