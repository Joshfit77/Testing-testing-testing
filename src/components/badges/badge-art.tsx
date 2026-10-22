"use client";

import { useId, type ReactNode } from "react";
import { BADGE_ARTWORK } from "@/components/badges/badge-artwork";
import type { RankCategory } from "@/lib/domain/ranks";

/**
 * Original vector artwork for the 27 rank badges, drawn in code so it stays sharp at any size.
 *
 *   Fitness: warrior shields in materials that rise from carved wood to silver-white with a gold aura.
 *   Food:    a fire that grows from a single spark to a phoenix, inside a gold-rimmed medallion.
 *   Faith:   a tree that grows from a seed to a towering cedar, inside a gold-rimmed medallion.
 *
 * `animate` turns on the living details (metal shimmer, flickering flames and embers, swaying leaves). It is
 * meant for the one badge in focus, not a whole grid, and every animation stops under reduced motion
 * (the system setting or the app's own setting, see globals.css).
 *
 * The owner's 27 painted badge images (badge-artwork.ts) are listed in BADGE_IMAGE_OVERRIDES and shown instead
 * of the vector drawing; the vector art stays as the fallback.
 */

export const BADGE_IMAGE_OVERRIDES: Partial<Record<`${RankCategory}-${number}`, string>> = Object.fromEntries(
  BADGE_ARTWORK.map((b) => [`${b.category}-${b.rank}`, b.image]),
);

export function BadgeArt({
  category,
  level,
  size = 96,
  locked = false,
  animate = false,
  className,
  title,
}: {
  category: RankCategory;
  level: number;
  size?: number;
  locked?: boolean;
  animate?: boolean;
  className?: string;
  /** Accessible name; omit when a visible label sits next to the badge. */
  title?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const override = BADGE_IMAGE_OVERRIDES[`${category}-${level}`];
  const style = locked ? { filter: "brightness(0.72) saturate(0.82)" } : undefined;
  if (override) {
    return (
      // The painted art is a 2 : 1 scene: `size` sets the frame's height, its width is twice that (never wider
      // than the space available), and the whole image is shown, centred, never cropped or stretched.
      <span className={["badge-img", animate && !locked ? "badge-img-live" : "", className].filter(Boolean).join(" ")} style={{ width: size * 2 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={override} alt={title ?? ""} style={style} draggable={false} decoding="async" />
      </span>
    );
  }
  const lv = Math.max(1, Math.min(9, Math.round(level)));
  const art = category === "fitness" ? <FitnessBadge level={lv} uid={uid} /> : category === "food" ? <FoodBadge level={lv} uid={uid} /> : <FaithBadge level={lv} uid={uid} />;
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={["badge-art", animate && !locked ? "badge-animate" : "", className].filter(Boolean).join(" ")}
      style={style}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {art}
    </svg>
  );
}

/* ------------------------------------------------------------------ shared pieces */

/** Deterministic pseudo-random numbers, so procedural foliage and embers look the same on every render. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Linear({ id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1 }: { id: string; stops: [number, string][]; x1?: number; y1?: number; x2?: number; y2?: number }) {
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      {stops.map(([o, c]) => (
        <stop key={o} offset={o} stopColor={c} />
      ))}
    </linearGradient>
  );
}

function Radial({ id, stops, cx = 0.5, cy = 0.5, r = 0.5 }: { id: string; stops: [number, string, number?][]; cx?: number; cy?: number; r?: number }) {
  return (
    <radialGradient id={id} cx={cx} cy={cy} r={r}>
      {stops.map(([o, c, op]) => (
        <stop key={o} offset={o} stopColor={c} stopOpacity={op ?? 1} />
      ))}
    </radialGradient>
  );
}

/** Polished gold used for rims, laurels and trim across all three sets. */
const GOLD: [number, string][] = [
  [0, "#fff1c4"],
  [0.22, "#e7c06a"],
  [0.5, "#a77a2c"],
  [0.72, "#e3b85e"],
  [1, "#6e4c17"],
];

function Sparkle({ x, y, r, cls }: { x: number; y: number; r: number; cls?: string }) {
  return <path className={cls} d={`M${x} ${y - r}L${x + r * 0.22} ${y - r * 0.22}L${x + r} ${y}L${x + r * 0.22} ${y + r * 0.22}L${x} ${y + r}L${x - r * 0.22} ${y + r * 0.22}L${x - r} ${y}L${x - r * 0.22} ${y - r * 0.22}Z`} fill="#fff7dc" />;
}

/* ------------------------------------------------------------------ Fitness: shields */

interface Metal {
  light: string;
  mid: string;
  dark: string;
  rim: [number, string][];
  emblem: [number, string][];
  glow?: string;
}

const FITNESS_METALS: Record<number, Metal> = {
  1: { light: "#a8743f", mid: "#7a4d24", dark: "#3e2410", rim: [[0, "#e9b77b"], [0.5, "#9a6230"], [1, "#4a2a10"]], emblem: [[0, "#cde59a"], [1, "#4f7a2a"]] },
  2: { light: "#d99a5a", mid: "#9c5f2a", dark: "#4b2a10", rim: GOLD, emblem: [[0, "#ffd9a8"], [0.5, "#b8763a"], [1, "#5e3412"]] },
  3: { light: "#eef2f6", mid: "#9aa6b3", dark: "#3c4550", rim: [[0, "#ffffff"], [0.45, "#a9b3bf"], [1, "#4a525c"]], emblem: [[0, "#ffffff"], [1, "#6e7c8c"]] },
  4: { light: "#ffe7a3", mid: "#c99a3c", dark: "#5e400f", rim: GOLD, emblem: [[0, "#fff2c8"], [0.5, "#d9a441"], [1, "#7a5214"]], glow: "#e9b955" },
  5: { light: "#9fe0ff", mid: "#2f7fc4", dark: "#0b2a52", rim: [[0, "#e8f7ff"], [0.5, "#8fb8d6"], [1, "#2b4766"]], emblem: [[0, "#e6f6ff"], [1, "#6aa6d1"]], glow: "#55b8ff" },
  6: { light: "#d9b3ff", mid: "#7a3fc9", dark: "#2a0f4f", rim: GOLD, emblem: [[0, "#e9fbff"], [0.4, "#7fd6ff"], [1, "#2a5fbf"]], glow: "#a56bff" },
  7: { light: "#c08cff", mid: "#5c2aa0", dark: "#1e0a3d", rim: GOLD, emblem: [[0, "#fff1c4"], [0.5, "#e2b55a"], [1, "#7a5214"]], glow: "#b07cff" },
  8: { light: "#ff8a8a", mid: "#b51d2a", dark: "#43070d", rim: [[0, "#f3f3f3"], [0.5, "#8d8d95"], [1, "#2e2e33"]], emblem: [[0, "#e6e6ea"], [1, "#55555c"]], glow: "#ff4d5a" },
  9: { light: "#ffffff", mid: "#cfd6df", dark: "#7c8794", rim: GOLD, emblem: [[0, "#ffffff"], [0.5, "#e9eef4"], [1, "#9aa5b2"]], glow: "#ffd77a" },
};

const SHIELD = "M60 14 L95 24 C95 58 86 84 60 104 C34 84 25 58 25 24 Z";
const SHIELD_INNER = "M60 20 L89 28.5 C89 58 81 80 60 97 C39 80 31 58 31 28.5 Z";

function Laurel({ uid, side, level }: { uid: string; side: 1 | -1; level: number }) {
  // Leaves follow an arc from beside the shield's shoulder down to its point, mirrored for each side.
  const n = level >= 7 ? 8 : 7;
  const leaves: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const theta = ((200 - t * 105) * Math.PI) / 180;
    const lx = 60 + Math.cos(theta) * 45;
    const y = 58 + Math.sin(theta) * 46;
    const x = side === -1 ? lx : 120 - lx;
    const deg = (theta * 180) / Math.PI;
    const rot = side === -1 ? deg + 20 : 180 - deg - 20;
    leaves.push(<ellipse key={i} cx={x} cy={y} rx={3.4} ry={8} transform={`rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`} fill={`url(#${uid}lg)`} stroke="#5a3d10" strokeWidth={0.4} />);
  }
  return (
    <g opacity={0.95}>
      <path d={side === -1 ? "M18 42 Q14 80 54 104" : "M102 42 Q106 80 66 104"} stroke="#8a6420" strokeWidth={1.2} fill="none" />
      {leaves}
    </g>
  );
}

function FitnessEmblem({ level, uid }: { level: number; uid: string }) {
  const f = `url(#${uid}em)`;
  switch (level) {
    case 1: // Foundation: a sprout carved from wood, planted on rock
      return (
        <g>
          <path d="M44 78 Q60 70 76 78 L74 82 L46 82 Z" fill="#5a5148" stroke="#2a241e" strokeWidth={0.6} />
          <path d="M60 78 C60 70 59 63 60 55" stroke="#3e5a1f" strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <path d="M60 62 C52 60 47 54 46 47 C54 47 59 52 60 62 Z" fill={f} />
          <path d="M60 58 C67 55 72 49 73 42 C65 43 60 49 60 58 Z" fill={f} />
        </g>
      );
    case 2: // Faithful: crested helmet with a sword behind it
      return (
        <g>
          <path d="M60 30 L62 84 L60 88 L58 84 Z" fill={`url(#${uid}steel)`} />
          <rect x={52} y={78} width={16} height={3} rx={1.2} fill="#7a5214" />
          <path d="M60 36 C46 36 41 48 42 60 L46 72 L54 72 L54 60 L66 60 L66 72 L74 72 L78 60 C79 48 74 36 60 36 Z" fill={f} stroke="#3e220a" strokeWidth={0.8} />
          <path d="M57 60 L57 72 M63 60 L63 72" stroke="#2a1606" strokeWidth={1.6} />
          <path d="M60 36 C66 26 80 26 86 34 C78 33 70 34 62 40 Z" fill="#b8282f" />
        </g>
      );
    case 3: // Endurance: mountain peaks
      return (
        <g>
          <path d="M34 80 L52 46 L60 58 L68 40 L86 80 Z" fill={f} stroke="#2e3640" strokeWidth={0.8} />
          <path d="M52 46 L57 56 L54 55 L50 58 Z M68 40 L74 53 L70 51 L66 55 L64 48 Z" fill="#ffffff" opacity={0.95} />
          <path d="M34 80 L86 80" stroke="#cfd8e2" strokeWidth={1} />
        </g>
      );
    case 4: {
      // Disciplined: lion crest
      const mane: ReactNode[] = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const x = 60 + Math.cos(a) * 17;
        const y = 58 + Math.sin(a) * 18;
        mane.push(<ellipse key={i} cx={x} cy={y} rx={6} ry={9} transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`} fill="#a8701c" stroke="#5a3a0a" strokeWidth={0.5} />);
      }
      return (
        <g>
          {mane}
          <ellipse cx={60} cy={59} rx={13} ry={15} fill={f} stroke="#6a4610" strokeWidth={0.7} />
          <path d="M53 55 L57 56 M67 55 L63 56" stroke="#3a2406" strokeWidth={1.8} strokeLinecap="round" />
          <path d="M56.5 64 L63.5 64 L60 68 Z" fill="#3a2406" />
          <path d="M60 68 L60 71 M55 72 Q60 75 65 72" stroke="#3a2406" strokeWidth={1.1} fill="none" strokeLinecap="round" />
        </g>
      );
    }
    case 5: // Refined: anvil with a blue refining flame
      return (
        <g>
          <path d="M60 30 C66 38 70 44 66 52 C64 56 56 56 54 52 C50 45 56 40 60 30 Z" fill="#7fd6ff" className="ba-flicker" />
          <path d="M60 39 C63 44 64 48 62 51 C61 53 59 53 58 51 C56 48 58 44 60 39 Z" fill="#e8fbff" className="ba-flicker" />
          <path d="M38 58 L82 58 C82 64 76 66 70 66 L68 72 L74 80 L46 80 L52 72 L50 66 C42 66 38 63 38 58 Z" fill={f} stroke="#1b3a5a" strokeWidth={0.8} />
          <path d="M38 58 L30 60 L38 62 Z" fill={f} />
        </g>
      );
    case 6: // Steadfast: faceted diamond
      return (
        <g>
          <path d="M42 50 L50 40 L70 40 L78 50 L60 80 Z" fill={f} stroke="#dff6ff" strokeWidth={0.6} />
          <path d="M42 50 L78 50 M50 40 L56 50 L60 80 M70 40 L64 50 L60 80 M56 50 L60 40 L64 50" stroke="#ffffff" strokeOpacity={0.65} strokeWidth={0.6} fill="none" />
          <path d="M50 40 L56 50 L42 50 Z" fill="#ffffff" opacity={0.45} />
          <Sparkle x={72} y={42} r={4} cls="ba-twinkle" />
        </g>
      );
    case 7: // Overcomer: royal crown with purple stones
      return (
        <g>
          <path d="M38 74 L36 46 L48 58 L60 38 L72 58 L84 46 L82 74 Z" fill={f} stroke="#5a3a0a" strokeWidth={0.8} />
          <rect x={37} y={72} width={46} height={8} rx={2} fill={f} stroke="#5a3a0a" strokeWidth={0.6} />
          {[36, 60, 84].map((x, i) => (
            <circle key={x} cx={x} cy={i === 1 ? 38 : 46} r={3.4} fill="#e9d7ff" stroke="#7a5214" strokeWidth={0.5} />
          ))}
          {[48, 60, 72].map((x) => (
            <ellipse key={x} cx={x} cy={76} rx={3.6} ry={2.6} fill="#8a3cff" stroke="#e9d7ff" strokeWidth={0.4} />
          ))}
          <ellipse cx={60} cy={62} rx={4} ry={5} fill="#a95bff" stroke="#f3e6ff" strokeWidth={0.5} />
        </g>
      );
    case 8: // Mighty: battle helm with a red plume
      return (
        <g>
          <path d="M60 22 C74 22 82 30 82 30 C76 26 68 28 62 34 Z" fill="#d6262f" />
          <path d="M60 32 C45 32 39 46 40 60 L44 78 L54 80 L54 64 L66 64 L66 80 L76 78 L80 60 C81 46 75 32 60 32 Z" fill={f} stroke="#1c1c20" strokeWidth={0.9} />
          <path d="M47 54 L73 54 L73 59 L66 59 L66 64 L54 64 L54 59 L47 59 Z" fill="#141418" />
          <path d="M60 33 L60 52" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1.2} />
        </g>
      );
    default: // Conqueror: cross over crossed swords
      return (
        <g>
          <path d="M34 36 L84 82 M86 36 L36 82" stroke={`url(#${uid}steel)`} strokeWidth={3.2} strokeLinecap="round" />
          <path d="M30 32 L38 40 M90 32 L82 40" stroke="#b78a2c" strokeWidth={4} strokeLinecap="round" />
          <path d="M54 30 L66 30 L66 46 L80 46 L80 58 L66 58 L66 86 L54 86 L54 58 L40 58 L40 46 L54 46 Z" fill={f} stroke="#b78a2c" strokeWidth={1.4} />
          <path d="M57 33 L57 83" stroke="#ffffff" strokeOpacity={0.8} strokeWidth={1} />
        </g>
      );
  }
}

function FitnessBadge({ level, uid }: { level: number; uid: string }) {
  const m = FITNESS_METALS[level]!;
  return (
    <>
      <defs>
        <Linear id={`${uid}body`} stops={[[0, m.light], [0.45, m.mid], [1, m.dark]]} x1={0.2} y1={0} x2={0.8} y2={1} />
        <Linear id={`${uid}rim`} stops={m.rim} x1={0} y1={0} x2={1} y2={1} />
        <Linear id={`${uid}em`} stops={m.emblem} x1={0.3} y1={0} x2={0.7} y2={1} />
        <Linear id={`${uid}lg`} stops={GOLD} x1={0} y1={0} x2={1} y2={1} />
        <Linear id={`${uid}steel`} stops={[[0, "#ffffff"], [0.5, "#b9c2cc"], [1, "#5d6672"]]} x1={0} y1={0} x2={1} y2={1} />
        <Radial id={`${uid}aura`} stops={[[0, m.glow ?? m.light, 0.75], [0.6, m.glow ?? m.light, 0.18], [1, m.glow ?? m.light, 0]]} />
        <Linear id={`${uid}shine`} stops={[[0, "#ffffff"], [1, "#ffffff"]]} />
        <clipPath id={`${uid}clip`}>
          <path d={SHIELD} />
        </clipPath>
        <linearGradient id={`${uid}band`} x1={0} y1={0} x2={1} y2={0}>
          <stop offset={0} stopColor="#fff" stopOpacity={0} />
          <stop offset={0.5} stopColor="#fff" stopOpacity={0.55} />
          <stop offset={1} stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      {m.glow ? <circle cx={60} cy={60} r={level === 9 ? 58 : 50} fill={`url(#${uid}aura)`} className="ba-glow" /> : null}
      {level === 9 ? (
        <g fill={`url(#${uid}lg)`} stroke="#6e4c17" strokeWidth={0.5}>
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={`l${i}`} d={`M28 ${34 + i * 9} C${14 - i * 2} ${30 + i * 9} ${4 + i} ${36 + i * 10} ${2 + i * 2} ${46 + i * 9} C${14} ${44 + i * 9} ${22} ${42 + i * 9} 30 ${40 + i * 9} Z`} />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={`r${i}`} d={`M92 ${34 + i * 9} C${106 + i * 2} ${30 + i * 9} ${116 - i} ${36 + i * 10} ${118 - i * 2} ${46 + i * 9} C${106} ${44 + i * 9} ${98} ${42 + i * 9} 90 ${40 + i * 9} Z`} />
          ))}
        </g>
      ) : null}
      {level >= 2 && level !== 9 ? (
        <>
          <Laurel uid={uid} side={-1} level={level} />
          <Laurel uid={uid} side={1} level={level} />
        </>
      ) : null}
      <path d={SHIELD} fill={`url(#${uid}rim)`} stroke="#1a1208" strokeWidth={0.8} />
      <path d={SHIELD_INNER} fill={`url(#${uid}body)`} />
      {level === 1 ? (
        <g stroke="#2e1a0a" strokeOpacity={0.45} strokeWidth={0.7} fill="none">
          {[40, 48, 56, 64, 72, 80].map((x) => (
            <path key={x} d={`M${x} 26 C${x - 2} 50 ${x + 2} 70 ${x} 96`} />
          ))}
        </g>
      ) : null}
      {level === 1 || level === 2 ? (
        <g fill="#e9b77b" stroke="#4a2a10" strokeWidth={0.4}>
          {[
            [36, 30],
            [84, 30],
            [36, 58],
            [84, 58],
            [60, 94],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={1.8} />
          ))}
        </g>
      ) : null}
      <path d={SHIELD_INNER} fill="none" stroke="#ffffff" strokeOpacity={0.28} strokeWidth={0.8} />
      <FitnessEmblem level={level} uid={uid} />
      <g clipPath={`url(#${uid}clip)`}>
        <path d="M25 14 L95 14 L95 40 C80 34 45 34 25 46 Z" fill="#ffffff" opacity={0.12} />
        <rect className="ba-shimmer" x={-30} y={0} width={24} height={120} fill={`url(#${uid}band)`} transform="skewX(-18)" />
      </g>
      {level >= 6 ? <Sparkle x={level === 9 ? 92 : 88} y={22} r={level === 9 ? 6 : 4.5} cls="ba-twinkle" /> : null}
    </>
  );
}

/* ------------------------------------------------------------------ medallion for Food and Faith */

function Medallion({ uid, level, bg, children, rays }: { uid: string; level: number; bg: [number, string, number?][]; children: ReactNode; rays?: string }) {
  return (
    <>
      <defs>
        <Linear id={`${uid}ring`} stops={GOLD} x1={0} y1={0} x2={1} y2={1} />
        <Radial id={`${uid}bg`} stops={bg} cx={0.5} cy={0.45} r={0.6} />
        <clipPath id={`${uid}mc`}>
          <circle cx={60} cy={60} r={46} />
        </clipPath>
        {rays ? <Radial id={`${uid}rays`} stops={[[0, rays, 0.6], [0.7, rays, 0.12], [1, rays, 0]]} /> : null}
      </defs>
      {rays ? <circle cx={60} cy={60} r={59} fill={`url(#${uid}rays)`} className="ba-glow" /> : null}
      {level >= 7 ? (
        <g fill={`url(#${uid}ring)`}>
          {Array.from({ length: level === 9 ? 24 : 16 }, (_, i) => {
            const a = (i / (level === 9 ? 24 : 16)) * Math.PI * 2;
            const x = 60 + Math.cos(a) * 54;
            const y = 60 + Math.sin(a) * 54;
            return <path key={i} d={`M${60 + Math.cos(a - 0.07) * 50} ${60 + Math.sin(a - 0.07) * 50} L${x} ${y} L${60 + Math.cos(a + 0.07) * 50} ${60 + Math.sin(a + 0.07) * 50} Z`} />;
          })}
        </g>
      ) : null}
      <circle cx={60} cy={60} r={51} fill={`url(#${uid}ring)`} stroke="#2a1c06" strokeWidth={0.8} />
      {level >= 4 ? <circle cx={60} cy={60} r={48.6} fill="none" stroke="#3a2808" strokeWidth={0.8} /> : null}
      <circle cx={60} cy={60} r={46} fill={`url(#${uid}bg)`} />
      <g clipPath={`url(#${uid}mc)`}>{children}</g>
      <circle cx={60} cy={60} r={46} fill="none" stroke="#000" strokeOpacity={0.5} strokeWidth={1.2} />
      <path d="M22 44 A40 40 0 0 1 60 18" stroke="#fff" strokeOpacity={0.35} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </>
  );
}

/* ------------------------------------------------------------------ Food: the growing fire */

/** A teardrop flame rising from (cx, base) with the given width and height, leaning by `lean`. */
function flamePath(cx: number, base: number, w: number, h: number, lean = 0): string {
  const top = base - h;
  return `M${cx - w / 2} ${base} C${cx - w / 2} ${base - h * 0.45} ${cx - w * 0.15 + lean * 0.5} ${base - h * 0.55} ${cx + lean} ${top} C${cx + w * 0.2 + lean * 0.5} ${base - h * 0.5} ${cx + w / 2} ${base - h * 0.4} ${cx + w / 2} ${base} Q${cx} ${base + w * 0.18} ${cx - w / 2} ${base} Z`;
}

function Flame({ uid, cx, base, w, h, lean = 0, delay = 0 }: { uid: string; cx: number; base: number; w: number; h: number; lean?: number; delay?: number }) {
  return (
    <g className="ba-flicker" style={{ animationDelay: `${delay}s` }}>
      <path d={flamePath(cx, base, w, h, lean)} fill={`url(#${uid}f1)`} />
      <path d={flamePath(cx, base, w * 0.66, h * 0.72, lean * 0.7)} fill={`url(#${uid}f2)`} />
      <path d={flamePath(cx, base, w * 0.34, h * 0.42, lean * 0.4)} fill="#fff6d8" opacity={0.92} />
    </g>
  );
}

function Embers({ seed, n, area }: { seed: number; n: number; area: [number, number, number, number] }) {
  const r = rng(seed);
  const [x0, y0, x1, y1] = area;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const x = x0 + r() * (x1 - x0);
        const y = y0 + r() * (y1 - y0);
        return <circle key={i} cx={x} cy={y} r={0.6 + r() * 1.1} fill={r() > 0.5 ? "#ffd27a" : "#ff8a2a"} className="ba-ember" style={{ animationDelay: `${(r() * 3).toFixed(2)}s` }} />;
      })}
    </g>
  );
}

function Logs() {
  return (
    <g>
      <rect x={34} y={84} width={52} height={7} rx={3.5} fill="#4a2a14" transform="rotate(-12 60 88)" />
      <rect x={34} y={84} width={52} height={7} rx={3.5} fill="#5c3418" transform="rotate(12 60 88)" />
      <ellipse cx={60} cy={92} rx={24} ry={3} fill="#ff7a1a" opacity={0.55} />
    </g>
  );
}

function FoodScene({ level, uid }: { level: number; uid: string }) {
  switch (level) {
    case 1:
      return (
        <g>
          <circle cx={60} cy={66} r={22} fill={`url(#${uid}glow)`} className="ba-glow" />
          <circle cx={60} cy={66} r={2.6} fill="#fff6d8" />
          <Sparkle x={60} y={66} r={9} cls="ba-twinkle" />
          <Embers seed={11} n={4} area={[50, 50, 70, 64]} />
        </g>
      );
    case 2:
      return (
        <g>
          <ellipse cx={60} cy={84} rx={30} ry={10} fill={`url(#${uid}glow)`} className="ba-glow" />
          {[
            [46, 82, 8],
            [58, 80, 10],
            [72, 83, 8],
            [52, 88, 9],
            [66, 88, 9],
          ].map(([x, y, r], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y} rx={r} ry={r! * 0.6} fill="#2a0e06" />
              <ellipse cx={x} cy={y! - 1} rx={r! * 0.7} ry={r! * 0.35} fill="#ff5a1f" opacity={0.85} className="ba-glow" />
            </g>
          ))}
          <Embers seed={22} n={8} area={[42, 56, 78, 76]} />
        </g>
      );
    case 3:
      return (
        <g>
          <ellipse cx={60} cy={88} rx={18} ry={4} fill="#ff7a1a" opacity={0.5} />
          <Flame uid={uid} cx={60} base={90} w={24} h={50} lean={2} />
          <Embers seed={33} n={6} area={[46, 34, 74, 58]} />
        </g>
      );
    case 4:
      return (
        <g>
          <path d="M56 100 L58 66 L62 66 L64 100 Z" fill="#6b4220" />
          <rect x={55} y={74} width={10} height={3} fill={`url(#${uid}ring)`} />
          <rect x={56} y={86} width={8} height={2.5} fill={`url(#${uid}ring)`} />
          <path d="M50 58 L70 58 L66 68 L54 68 Z" fill={`url(#${uid}ring)`} stroke="#3a2808" strokeWidth={0.5} />
          <Flame uid={uid} cx={60} base={60} w={22} h={40} lean={-2} />
          <Embers seed={44} n={6} area={[46, 22, 74, 44]} />
        </g>
      );
    case 5:
      return (
        <g>
          <Logs />
          <Flame uid={uid} cx={50} base={88} w={20} h={40} lean={-4} delay={0.3} />
          <Flame uid={uid} cx={70} base={88} w={20} h={38} lean={4} delay={0.6} />
          <Flame uid={uid} cx={60} base={88} w={28} h={56} />
          <Embers seed={55} n={10} area={[38, 24, 82, 52]} />
        </g>
      );
    case 6:
      return (
        <g>
          <path d="M26 100 L26 62 Q60 22 94 62 L94 100 Z" fill="#4a4038" stroke="#1e1a16" strokeWidth={0.8} />
          <g stroke="#2a241e" strokeWidth={0.7}>
            {[70, 80, 90].map((y) => (
              <path key={y} d={`M26 ${y} L94 ${y}`} />
            ))}
            <path d="M40 62 L40 70 M60 70 L60 80 M80 62 L80 70 M48 80 L48 90 M72 80 L72 90" />
          </g>
          <path d="M40 100 L40 72 Q60 46 80 72 L80 100 Z" fill="#1a0804" />
          <path d="M42 100 L42 74 Q60 52 78 74 L78 100 Z" fill={`url(#${uid}glow)`} />
          <Flame uid={uid} cx={52} base={98} w={14} h={26} lean={-2} delay={0.2} />
          <Flame uid={uid} cx={68} base={98} w={14} h={24} lean={2} delay={0.5} />
          <Flame uid={uid} cx={60} base={98} w={18} h={34} />
        </g>
      );
    case 7:
      return (
        <g>
          <ellipse cx={60} cy={70} rx={30} ry={18} fill={`url(#${uid}glow)`} className="ba-glow" />
          <path d="M28 66 L86 66 C86 74 78 77 70 77 L67 84 L76 96 L44 96 L53 84 L50 77 C38 77 28 74 28 66 Z" fill="#2c2f36" stroke="#0e0f12" strokeWidth={0.8} />
          <path d="M28 66 L18 69 L28 72 Z" fill="#2c2f36" />
          <path d="M32 66 L84 66" stroke="#8d939e" strokeWidth={1.2} />
          <path d="M74 40 L90 30 L94 36 L78 46 Z" fill="#5a3a1a" />
          <rect x={64} y={40} width={16} height={9} rx={1.5} fill="#6d737e" transform="rotate(-32 72 44)" />
          <Embers seed={77} n={14} area={[40, 34, 84, 64]} />
          <Sparkle x={58} y={58} r={6} cls="ba-twinkle" />
        </g>
      );
    case 8:
      return (
        <g>
          <ellipse cx={60} cy={92} rx={26} ry={5} fill="#ff6a12" opacity={0.6} />
          <Flame uid={uid} cx={60} base={96} w={38} h={46} />
          <Flame uid={uid} cx={56} base={74} w={30} h={34} lean={6} delay={0.2} />
          <Flame uid={uid} cx={64} base={56} w={24} h={30} lean={-6} delay={0.4} />
          <Flame uid={uid} cx={58} base={40} w={16} h={24} lean={4} delay={0.6} />
          <Embers seed={88} n={14} area={[30, 18, 90, 70]} />
        </g>
      );
    default:
      return (
        <g>
          <circle cx={60} cy={58} r={40} fill={`url(#${uid}glow)`} className="ba-glow" />
          <Flame uid={uid} cx={60} base={104} w={34} h={30} delay={0.1} />
          <g className="ba-wings">
            <path d="M60 64 C46 52 30 50 18 34 C30 36 36 34 40 28 C42 40 50 48 60 54 Z" fill={`url(#${uid}f1)`} />
            <path d="M60 64 C74 52 90 50 102 34 C90 36 84 34 80 28 C78 40 70 48 60 54 Z" fill={`url(#${uid}f1)`} />
            <path d="M60 60 C50 52 38 48 30 40 C40 42 46 40 48 36 C50 44 54 50 60 54 Z" fill={`url(#${uid}f2)`} />
            <path d="M60 60 C70 52 82 48 90 40 C80 42 74 40 72 36 C70 44 66 50 60 54 Z" fill={`url(#${uid}f2)`} />
          </g>
          <path d="M60 36 C64 40 66 48 64 58 C63 66 62 74 60 82 C58 74 57 66 56 58 C54 48 56 40 60 36 Z" fill={`url(#${uid}f2)`} />
          <circle cx={60} cy={36} r={4.6} fill="#ffcf5a" />
          <path d="M60 31 C62 26 66 22 70 21 C66 25 64 28 62 32 Z" fill="#ff8a2a" />
          <path d="M64 35 L69 36.5 L64 38 Z" fill="#7a3a0a" />
          <path d="M56 82 C52 90 46 94 40 96 M60 84 C60 92 60 96 60 100 M64 82 C68 90 74 94 80 96" stroke="#ff9a2a" strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <Embers seed={99} n={16} area={[22, 16, 98, 60]} />
        </g>
      );
  }
}

function FoodBadge({ level, uid }: { level: number; uid: string }) {
  const bg: [number, string, number?][] =
    level >= 8
      ? [
          [0, "#5a1606"],
          [0.6, "#220703"],
          [1, "#0a0302"],
        ]
      : [
          [0, "#2a1208"],
          [0.7, "#0e0604"],
          [1, "#050302"],
        ];
  return (
    <>
      <defs>
        <Linear id={`${uid}f1`} stops={[[0, "#ffe08a"], [0.35, "#ff9a24"], [0.75, "#e2421a"], [1, "#8a1608"]]} x1={0} y1={0} x2={0} y2={1} />
        <Linear id={`${uid}f2`} stops={[[0, "#fff6c8"], [0.5, "#ffd05a"], [1, "#ff8a1a"]]} x1={0} y1={0} x2={0} y2={1} />
        <Radial id={`${uid}glow`} stops={[[0, "#ffb347", 0.85], [0.5, "#ff6a1a", 0.35], [1, "#ff3a0a", 0]]} />
      </defs>
      <Medallion uid={uid} level={level} bg={bg} rays={level === 9 ? "#ffb347" : undefined}>
        <FoodScene level={level} uid={uid} />
      </Medallion>
    </>
  );
}

/* ------------------------------------------------------------------ Faith: the growing tree */

const LEAF_GREENS = ["#2f6b2a", "#3f8a32", "#58a63e", "#7cc24f", "#a4d86a"];

/** A canopy of overlapping leaf clusters around (cx, cy) inside an ellipse of rx × ry. */
function Canopy({ seed, cx, cy, rx, ry, n, palette = LEAF_GREENS, fruit }: { seed: number; cx: number; cy: number; rx: number; ry: number; n: number; palette?: string[]; fruit?: { color: string; n: number; r: number } }) {
  const r = rng(seed);
  const clusters = Array.from({ length: n }, () => {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    return { x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, s: 5 + r() * 6, c: palette[Math.floor(r() * palette.length)]! };
  }).sort((p, q) => p.y - q.y);
  const fruits = fruit
    ? Array.from({ length: fruit.n }, () => {
        const a = r() * Math.PI * 2;
        const d = 0.25 + r() * 0.7;
        return { x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d };
      })
    : [];
  return (
    <g className="ba-sway">
      {clusters.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={c.s} fill={c.c} stroke="#16300f" strokeOpacity={0.35} strokeWidth={0.5} />
      ))}
      {clusters
        .filter((_, i) => i % 3 === 0)
        .map((c, i) => (
          <circle key={`h${i}`} cx={c.x - c.s * 0.3} cy={c.y - c.s * 0.35} r={c.s * 0.4} fill="#e6ffb0" opacity={0.25} />
        ))}
      {fruits.map((f, i) => (
        <g key={`f${i}`}>
          <circle cx={f.x} cy={f.y} r={fruit!.r} fill={fruit!.color} stroke="#2a0a0a" strokeOpacity={0.4} strokeWidth={0.4} />
          <circle cx={f.x - fruit!.r * 0.35} cy={f.y - fruit!.r * 0.35} r={fruit!.r * 0.35} fill="#fff" opacity={0.45} />
        </g>
      ))}
    </g>
  );
}

function Soil({ uid, y = 88 }: { uid: string; y?: number }) {
  return (
    <g>
      <path d={`M10 ${y + 4} Q60 ${y - 10} 110 ${y + 4} L110 120 L10 120 Z`} fill={`url(#${uid}soil)`} />
      <path d={`M10 ${y + 4} Q60 ${y - 10} 110 ${y + 4}`} stroke="#6b4a2a" strokeWidth={0.8} fill="none" />
    </g>
  );
}

function Trunk({ x, base, top, w, color = "#5a3a1e" }: { x: number; base: number; top: number; w: number; color?: string }) {
  return (
    <g>
      <path d={`M${x - w} ${base} C${x - w * 0.6} ${(base + top) / 2} ${x - w * 0.35} ${top + 6} ${x - w * 0.25} ${top} L${x + w * 0.25} ${top} C${x + w * 0.35} ${top + 6} ${x + w * 0.6} ${(base + top) / 2} ${x + w} ${base} Z`} fill={color} />
      <path d={`M${x - w * 0.2} ${base - 2} C${x - w * 0.1} ${(base + top) / 2} ${x} ${top + 8} ${x} ${top + 2}`} stroke="#2e1a0a" strokeOpacity={0.5} strokeWidth={0.7} fill="none" />
    </g>
  );
}

function Roots({ x, y, spread, depth, glow }: { x: number; y: number; spread: number; depth: number; glow?: boolean }) {
  const r = rng(Math.round(spread * 7 + depth));
  const paths = Array.from({ length: 7 }, (_, i) => {
    const dx = ((i - 3) / 3) * spread;
    const ex = x + dx + (r() - 0.5) * 6;
    const ey = y + depth * (0.6 + r() * 0.4);
    return `M${x} ${y} C${x + dx * 0.2} ${y + depth * 0.3} ${x + dx * 0.8} ${y + depth * 0.4} ${ex} ${ey}`;
  });
  return (
    <g fill="none" strokeLinecap="round">
      {glow ? paths.map((d, i) => <path key={`g${i}`} d={d} stroke="#ffd77a" strokeOpacity={0.45} strokeWidth={4} className="ba-glow" />) : null}
      {paths.map((d, i) => (
        <path key={i} d={d} stroke={glow ? "#ffe9a8" : "#7a5230"} strokeWidth={glow ? 1.3 : 1.1} />
      ))}
    </g>
  );
}

function FallingLeaf({ x, y, delay }: { x: number; y: number; delay: number }) {
  return <path className="ba-leaf" style={{ animationDelay: `${delay}s` }} d={`M${x} ${y} c3 -3 7 -2 8 0 c-3 3 -6 3 -8 0 Z`} fill="#8cc35a" />;
}

function FaithScene({ level, uid }: { level: number; uid: string }) {
  switch (level) {
    case 1:
      return (
        <g>
          <Soil uid={uid} y={70} />
          <ellipse cx={60} cy={76} rx={11} ry={7} fill={`url(#${uid}seed)`} transform="rotate(-18 60 76)" stroke="#3a2208" strokeWidth={0.6} />
          <path d="M53 75 Q60 70 67 74" stroke="#fff3c8" strokeOpacity={0.55} strokeWidth={1} fill="none" />
          <circle cx={60} cy={74} r={20} fill={`url(#${uid}halo)`} className="ba-glow" />
        </g>
      );
    case 2:
      return (
        <g>
          <Soil uid={uid} y={76} />
          <g className="ba-sway">
            <path d="M60 80 C60 70 59 62 60 54" stroke="#4f8a2a" strokeWidth={2.6} fill="none" strokeLinecap="round" />
            <path d="M60 62 C52 62 45 56 44 48 C53 48 59 54 60 62 Z" fill="#7cc24f" />
            <path d="M60 58 C67 56 73 50 74 42 C66 43 60 49 60 58 Z" fill="#a4d86a" />
          </g>
        </g>
      );
    case 3:
      return (
        <g>
          <Soil uid={uid} y={82} />
          <Roots x={60} y={86} spread={14} depth={14} />
          <Trunk x={60} base={86} top={46} w={3.2} />
          <path d="M60 64 L48 54 M60 58 L72 48 M60 70 L70 64" stroke="#5a3a1e" strokeWidth={1.6} strokeLinecap="round" />
          <Canopy seed={3} cx={48} cy={50} rx={6} ry={5} n={5} />
          <Canopy seed={4} cx={72} cy={45} rx={7} ry={5} n={6} />
          <Canopy seed={5} cx={60} cy={40} rx={8} ry={6} n={6} />
        </g>
      );
    case 4:
      return (
        <g>
          <rect x={10} y={62} width={100} height={60} fill={`url(#${uid}soil)`} />
          <path d="M10 62 L110 62" stroke="#8a6a3a" strokeWidth={0.8} />
          <Roots x={60} y={62} spread={36} depth={36} glow />
          <Trunk x={60} base={63} top={34} w={3.6} />
          <Canopy seed={6} cx={60} cy={32} rx={20} ry={11} n={18} />
        </g>
      );
    case 5:
      return (
        <g>
          <Soil uid={uid} y={88} />
          <Trunk x={60} base={92} top={44} w={5} />
          <path d="M60 60 L42 46 M60 54 L80 40 M60 66 L78 58" stroke="#5a3a1e" strokeWidth={2.2} strokeLinecap="round" />
          <Canopy seed={7} cx={60} cy={40} rx={30} ry={18} n={30} />
          <FallingLeaf x={82} y={52} delay={0.5} />
        </g>
      );
    case 6:
      return (
        <g>
          <Soil uid={uid} y={88} />
          <Trunk x={60} base={92} top={40} w={5.5} />
          <Canopy seed={8} cx={60} cy={36} rx={30} ry={15} n={28} />
          <g className="ba-sway">
            <path d="M52 90 C72 84 46 76 66 70 C80 66 44 60 62 52 C70 48 52 44 58 38" stroke="#4f8a2a" strokeWidth={2} fill="none" />
            {[
              [64, 84],
              [50, 76],
              [70, 66],
              [48, 58],
              [66, 48],
            ].map(([x, y], i) => (
              <path key={i} d={`M${x} ${y} c4 -4 9 -3 10 0 c-4 4 -8 4 -10 0 Z`} fill="#7cc24f" />
            ))}
            {[
              [70, 72],
              [46, 64],
            ].map(([x, y], i) => (
              <g key={`g${i}`} fill="#6a2a8a">
                <circle cx={x} cy={y} r={2} />
                <circle cx={x! + 3} cy={y} r={2} />
                <circle cx={x! + 1.5} cy={y! + 3} r={2} />
              </g>
            ))}
          </g>
        </g>
      );
    case 7:
      return (
        <g>
          <Soil uid={uid} y={90} />
          <Trunk x={60} base={94} top={46} w={6} />
          <Canopy seed={9} cx={60} cy={42} rx={34} ry={20} n={36} fruit={{ color: "#d62a2a", n: 12, r: 2.8 }} />
          <FallingLeaf x={30} y={60} delay={1.2} />
        </g>
      );
    case 8:
      return (
        <g>
          <Soil uid={uid} y={92} />
          <path d="M52 96 C50 84 58 80 54 70 C52 64 58 58 60 52 C62 58 70 62 66 70 C62 80 72 84 70 96 Z" fill="#6b5a44" stroke="#3a2e20" strokeWidth={0.8} />
          <path d="M56 92 C56 82 62 78 58 70" stroke="#3a2e20" strokeWidth={0.8} fill="none" />
          <Canopy seed={10} cx={60} cy={42} rx={36} ry={18} n={40} palette={["#6f8a5a", "#88a06c", "#9fb486", "#b9c9a2", "#5d7a4c"]} fruit={{ color: "#3a4a1a", n: 14, r: 2 }} />
          <FallingLeaf x={86} y={58} delay={0.8} />
        </g>
      );
    default:
      return (
        <g>
          <rect x={10} y={10} width={100} height={100} fill={`url(#${uid}sky)`} />
          <circle cx={60} cy={20} r={34} fill={`url(#${uid}halo)`} className="ba-glow" />
          <path d="M10 88 L30 70 L44 80 L62 62 L84 78 L98 68 L110 76 L110 110 L10 110 Z" fill="#3b4a5c" opacity={0.85} />
          <Soil uid={uid} y={94} />
          <Trunk x={60} base={98} top={30} w={4.5} color="#6a4426" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            // Broad, layered cedar tiers that droop at the tips, widest near the base.
            const y = 30 + i * 8;
            const w = 10 + i * 4.6;
            const d = `M${60 - w} ${y + 7} C${60 - w * 0.7} ${y - 1} ${60 - w * 0.3} ${y - 4} 60 ${y - 5} C${60 + w * 0.3} ${y - 4} ${60 + w * 0.7} ${y - 1} ${60 + w} ${y + 7} C${60 + w * 0.6} ${y + 4} ${60 + w * 0.3} ${y + 6} 60 ${y + 4} C${60 - w * 0.3} ${y + 6} ${60 - w * 0.6} ${y + 4} ${60 - w} ${y + 7} Z`;
            return (
              <g key={i} className="ba-sway">
                <path d={d} fill={i % 2 ? "#245a30" : "#2f6e3b"} stroke="#123019" strokeWidth={0.6} />
                <path d={`M${60 - w * 0.85} ${y + 4} C${60 - w * 0.4} ${y - 2} ${60 + w * 0.4} ${y - 2} ${60 + w * 0.85} ${y + 4}`} stroke="#9fd38a" strokeOpacity={0.45} strokeWidth={0.7} fill="none" />
              </g>
            );
          })}
          <path d="M60 18 C58 22 57 26 56 30 L64 30 C63 26 62 22 60 18 Z" fill="#2f6e3b" />
          <Sparkle x={86} y={24} r={4} cls="ba-twinkle" />
        </g>
      );
  }
}

function FaithBadge({ level, uid }: { level: number; uid: string }) {
  const bg: [number, string, number?][] =
    level === 9
      ? [
          [0, "#2a3448"],
          [1, "#0a0d14"],
        ]
      : [
          [0, "#1e2a16"],
          [0.7, "#0c1208"],
          [1, "#050704"],
        ];
  return (
    <>
      <defs>
        <Linear id={`${uid}soil`} stops={[[0, "#4a3220"], [1, "#1a0f08"]]} />
        <Linear id={`${uid}seed`} stops={[[0, "#f3d08a"], [0.5, "#b9853a"], [1, "#6a4416"]]} x1={0} y1={0} x2={1} y2={1} />
        <Linear id={`${uid}sky`} stops={[[0, "#f6d98a"], [0.35, "#7d8fb0"], [1, "#1a2234"]]} />
        <Radial id={`${uid}halo`} stops={[[0, "#ffe7a3", 0.7], [0.6, "#ffd77a", 0.15], [1, "#ffd77a", 0]]} />
      </defs>
      <Medallion uid={uid} level={level} bg={bg} rays={level === 9 ? "#ffe7a3" : undefined}>
        <FaithScene level={level} uid={uid} />
      </Medallion>
    </>
  );
}
