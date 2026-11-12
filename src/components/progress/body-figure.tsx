"use client";

import type { KeyboardEvent } from "react";
import { BODY_REGION_LABELS, type BodyRegion } from "@/lib/domain/body-regions";
import { cn } from "@/lib/utils";

/**
 * An original front-and-back figure for the muscle map. Each region is a button (keyboard and screen-reader
 * accessible); the region list next to it is the text alternative. Shapes are drawn for the left side and mirrored.
 */

export type FigureView = "front" | "back";

/** Mirror an absolute path ("M x,y C x,y …") across the figure's centre line (x = 100). */
function mirror(d: string): string {
  return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${200 - Number(x)},${y}`);
}
const pair = (d: string) => [d, mirror(d)];

const SHAPES: Record<FigureView, Partial<Record<BodyRegion, string[]>>> = {
  front: {
    shoulders: pair("M78,72 C66,70 54,78 52,92 C52,99 56,103 61,102 C64,93 70,85 80,79 Z"),
    chest: pair("M100,78 L82,79 C71,84 65,95 67,106 C74,115 90,117 100,112 Z"),
    biceps: pair("M57,106 C50,114 48,127 50,139 C54,144 60,144 62,139 C64,127 64,114 62,106 Z"),
    forearms: pair("M50,146 C44,158 42,173 44,187 C47,191 52,191 54,187 C58,173 60,158 60,146 Z"),
    abdominals: [
      "M87,116 C93,118 107,118 113,116 L115,150 C115,170 109,185 100,189 C91,185 85,170 85,150 Z",
      ...pair("M83,116 L85,117 L84,150 C84,166 87,178 91,187 C83,183 78,169 77,150 C77,136 79,124 83,116 Z"),
    ],
    quadriceps: pair("M78,206 C72,228 72,258 78,283 C84,291 93,291 97,283 C100,258 100,229 98,207 Z"),
    calves: pair("M80,304 C76,322 78,346 82,364 C86,369 92,369 94,364 C96,346 96,322 94,304 Z"),
  },
  back: {
    shoulders: pair("M78,72 C66,70 54,78 52,92 C52,99 56,103 61,102 C64,93 70,85 80,79 Z"),
    upper_back: ["M100,66 L84,70 L74,78 C71,96 75,118 83,137 C89,145 96,149 100,149 C104,149 111,145 117,137 C125,118 129,96 126,78 L116,70 Z"],
    triceps: pair("M57,106 C50,114 48,127 50,139 C54,144 60,144 62,139 C64,127 64,114 62,106 Z"),
    forearms: pair("M50,146 C44,158 42,173 44,187 C47,191 52,191 54,187 C58,173 60,158 60,146 Z"),
    lower_back: ["M87,151 C93,155 107,155 113,151 L116,183 C110,188 90,188 84,183 Z"],
    glutes: pair("M80,189 C75,199 75,214 82,222 C89,227 97,223 100,215 L100,191 C94,187 85,186 80,189 Z"),
    hamstrings: pair("M78,226 C74,245 76,266 80,284 C86,290 93,290 97,284 C99,264 99,245 98,228 Z"),
    calves: pair("M80,300 C74,316 76,338 82,354 C86,360 92,360 95,354 C98,338 97,316 94,300 Z"),
  },
};

/** Parts of the body that aren't regions (head, hands, knees, feet…), drawn underneath. */
const BASE = [
  "M100,12 C112,12 118,22 118,34 C118,46 111,55 100,55 C89,55 82,46 82,34 C82,22 88,12 100,12 Z",
  "M92,54 L108,54 L110,68 L90,68 Z",
  "M80,68 C88,66 112,66 120,68 L132,76 C138,96 136,120 132,140 L128,186 L126,204 L74,204 L72,186 L68,140 C64,120 62,96 68,76 Z",
  ...pair("M46,192 C40,196 40,206 46,210 C51,212 55,206 54,198 Z"),
  ...pair("M80,284 C78,292 80,302 88,304 C95,304 98,294 97,284 Z"),
  ...pair("M82,364 C78,370 78,378 86,380 C93,381 97,376 94,364 Z"),
  ...pair("M54,100 C58,104 63,106 63,106 L62,142 L60,146 L50,146 L49,140 Z"),
];

export interface RegionPaint {
  fill: string;
  /** Hatched: not assessed / no data, so the difference isn't only colour. */
  hatched?: boolean;
  label: string;
}

export function BodyFigure({
  view,
  paint,
  selected,
  onSelect,
  className,
}: {
  view: FigureView;
  paint: Record<BodyRegion, RegionPaint>;
  selected: BodyRegion | null;
  onSelect: (r: BodyRegion) => void;
  className?: string;
}) {
  const regions = Object.entries(SHAPES[view]) as [BodyRegion, string[]][];
  const key = (r: BodyRegion) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(r);
    }
  };
  return (
    <svg viewBox="0 0 200 392" className={cn("h-auto w-full max-w-[15rem]", className)} role="group" aria-label={`Body, ${view} view`} data-testid={`body-figure-${view}`}>
      <defs>
        <pattern id={`hatch-${view}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#1f1d19" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#4a4436" strokeWidth="2" />
        </pattern>
        <linearGradient id={`sheen-${view}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <g fill="#171612" stroke="#3a352a" strokeWidth="1">
        {BASE.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {view === "back" && <path d="M100,70 L100,186" stroke="#3a352a" strokeWidth="1" fill="none" />}
      {regions.map(([r, paths]) => {
        const p = paint[r];
        const isSel = selected === r;
        return (
          <g
            key={r}
            role="button"
            tabIndex={0}
            aria-label={`${BODY_REGION_LABELS[r]}: ${p.label}`}
            aria-pressed={isSel}
            data-region={r}
            onClick={() => onSelect(r)}
            onKeyDown={key(r)}
            className="cursor-pointer outline-none [&:focus-visible_path]:stroke-[#f3dc8b] [&:focus-visible_path]:[stroke-width:2.5]"
          >
            {paths.map((d, i) => (
              <g key={i}>
                <path d={d} fill={p.hatched ? `url(#hatch-${view})` : p.fill} stroke={isSel ? "#f3dc8b" : "#0b0a08"} strokeWidth={isSel ? 2.5 : 1} />
                {!p.hatched && <path d={d} fill={`url(#sheen-${view})`} pointerEvents="none" />}
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
