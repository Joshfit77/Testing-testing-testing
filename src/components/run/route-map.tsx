import { useId } from "react";

/**
 * The recorded route drawn from its own GPS points (no map tiles: nothing about the route is sent to a map service).
 * Each unbroken stretch is a line; pauses and signal gaps show as breaks. North is up.
 */
export function RouteMap({ coordinates, className, label }: { coordinates: [number, number][][]; className?: string; label?: string }) {
  const id = useId();
  const lines = coordinates.filter((l) => l.length >= 2);
  if (!lines.length) return null;
  const all = lines.flat();
  const lat0 = all.reduce((s, p) => s + p[1], 0) / all.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const M = 111_195; // metres per degree of latitude
  const xs = all.map((p) => p[0] * k * M);
  const ys = all.map((p) => -p[1] * M);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 50);
  const spanY = Math.max(maxY - minY, 50);
  const W = 320;
  const H = 200;
  const pad = 16;
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const ox = pad + ((W - 2 * pad) - spanX * scale) / 2;
  const oy = pad + ((H - 2 * pad) - spanY * scale) / 2;
  const pt = (p: [number, number]) => [ox + (p[0] * k * M - minX) * scale, oy + (-p[1] * M - minY) * scale] as const;
  // A round-number scale bar about a quarter of the width.
  const target = (W / 4) / scale;
  const nice = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000].find((n) => n >= target) ?? 10000;
  const barPx = nice * scale;
  const start = pt(lines[0]![0]!);
  const end = pt(lines.at(-1)!.at(-1)!);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-labelledby={`${id}-t`} data-testid="route-map">
      <title id={`${id}-t`}>{label ?? `Route map with ${lines.length} recorded ${lines.length === 1 ? "stretch" : "stretches"}`}</title>
      <rect x="0" y="0" width={W} height={H} rx="14" fill="#100f0d" stroke="#2a261f" />
      {lines.map((l, i) => (
        <polyline key={i} points={l.map((p) => pt(p).join(",")).join(" ")} fill="none" stroke="#C9A54C" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      <circle cx={start[0]} cy={start[1]} r="5" fill="#5fc49a" stroke="#0b0a07" strokeWidth="2">
        <title>Start</title>
      </circle>
      <circle cx={end[0]} cy={end[1]} r="5" fill="#f08a8a" stroke="#0b0a07" strokeWidth="2">
        <title>Finish</title>
      </circle>
      <g transform={`translate(${W - pad - barPx} ${H - 12})`}>
        <line x1="0" y1="0" x2={barPx} y2="0" stroke="#a39a86" strokeWidth="2" />
        <text x={barPx / 2} y="-4" textAnchor="middle" fontSize="10" fill="#a39a86">
          {nice >= 1000 ? `${nice / 1000} km` : `${nice} m`}
        </text>
      </g>
      <text x={pad} y={H - 8} fontSize="10" fill="#a39a86">
        N ↑
      </text>
    </svg>
  );
}
