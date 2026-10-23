import { useId } from "react";

type LngLat = [number, number];

const M = 111_195; // metres per degree of latitude
const MILE = 1609.344;

/** Great-circle-free local distance between two [lng, lat] points (metres): fine at route scale. */
function metres(a: LngLat, b: LngLat, k: number): number {
  return Math.hypot((b[0] - a[0]) * k * M, (b[1] - a[1]) * M);
}

/** Points at each whole kilometre or mile along the recorded lines (breaks are skipped, never bridged). */
export function distanceMarkers(lines: LngLat[][], unit: "km" | "mi"): { n: number; at: LngLat }[] {
  const size = unit === "mi" ? MILE : 1000;
  const all = lines.flat();
  if (!all.length) return [];
  const lat0 = all.reduce((s, p) => s + p[1], 0) / all.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const out: { n: number; at: LngLat }[] = [];
  let d = 0;
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]!;
      const b = line[i]!;
      const step = metres(a, b, k);
      while (step > 0 && (out.length + 1) * size <= d + step) {
        const f = ((out.length + 1) * size - d) / step;
        out.push({ n: out.length + 1, at: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] });
      }
      d += step;
    }
  }
  return out;
}

/**
 * The recorded route drawn from its own GPS points (no map tiles: nothing about the route is sent to a map service).
 * Each unbroken stretch is a solid line; a pause or a stretch without signal shows as a faint dashed join that is not
 * counted. Start and finish are marked, with a marker at each kilometre or mile and a scale bar. North is up.
 * While recording, `current` adds where the smoothed track puts you now, with its uncertainty.
 */
export function RouteMap({
  coordinates,
  className,
  label,
  unit = "km",
  current,
}: {
  coordinates: LngLat[][];
  className?: string;
  label?: string;
  unit?: "km" | "mi";
  current?: { lat: number; lng: number; accuracy: number } | null;
}) {
  const id = useId();
  const lines = coordinates.filter((l) => l.length >= 2);
  if (!lines.length) return null;
  const all = lines.flat();
  if (current) all.push([current.lng, current.lat]);
  const lat0 = all.reduce((s, p) => s + p[1], 0) / all.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
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
  const pad = 18;
  // A band along the bottom is kept for the scale bar and the north arrow, so the route never runs under them.
  const bottom = 30;
  const scale = Math.min((W - 2 * pad) / spanX, (H - pad - bottom) / spanY);
  const ox = pad + (W - 2 * pad - spanX * scale) / 2;
  const oy = pad + (H - pad - bottom - spanY * scale) / 2;
  const pt = (p: LngLat) => [ox + (p[0] * k * M - minX) * scale, oy + (-p[1] * M - minY) * scale] as const;
  // A round-number scale bar about a quarter of the width, in the member's units.
  const target = W / 4 / scale;
  const steps =
    unit === "mi"
      ? [
          [25 * 0.3048, "25 ft"],
          [50 * 0.3048, "50 ft"],
          [100 * 0.3048, "100 ft"],
          [250 * 0.3048, "250 ft"],
          [500 * 0.3048, "500 ft"],
          [MILE / 4, "¼ mi"],
          [MILE / 2, "½ mi"],
          [MILE, "1 mi"],
          [2 * MILE, "2 mi"],
          [5 * MILE, "5 mi"],
        ]
      : [
          [10, "10 m"],
          [20, "20 m"],
          [50, "50 m"],
          [100, "100 m"],
          [200, "200 m"],
          [500, "500 m"],
          [1000, "1 km"],
          [2000, "2 km"],
          [5000, "5 km"],
          [10000, "10 km"],
        ];
  const bar = (steps.find(([m]) => (m as number) >= target) ?? steps.at(-1)!) as [number, string];
  const barPx = bar[0] * scale;
  const start = pt(lines[0]![0]!);
  const end = pt(lines.at(-1)!.at(-1)!);
  const markers = distanceMarkers(lines, unit);
  // Keep the map readable on long routes: at most about ten markers.
  const every = markers.length > 10 ? Math.ceil(markers.length / 10) : 1;
  const breaks = lines.slice(1).map((l, i) => [pt(lines[i]!.at(-1)!), pt(l[0]!)] as const);
  const here = current ? pt([current.lng, current.lat]) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-labelledby={`${id}-t`} data-testid="route-map">
      <title id={`${id}-t`}>
        {label ?? `Route map with ${lines.length} recorded ${lines.length === 1 ? "stretch" : "stretches"}`}
        {markers.length ? `, ${markers.length} ${unit} marker${markers.length === 1 ? "" : "s"}` : ""}
      </title>
      <rect x="0" y="0" width={W} height={H} rx="14" fill="#100f0d" stroke="#2a261f" />
      {breaks.map(([a, b], i) => (
        <line key={`b${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#a39a86" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="3 4" data-testid="route-break">
          <title>Break in the recording (a pause or no GPS signal): not counted</title>
        </line>
      ))}
      {lines.map((l, i) => (
        <polyline key={i} points={l.map((p) => pt(p).join(",")).join(" ")} fill="none" stroke="#C9A54C" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {markers
        .filter((m) => m.n % every === 0)
        .map((m) => {
          const [x, y] = pt(m.at);
          return (
            <g key={`m${m.n}`} data-testid="route-marker">
              <circle cx={x} cy={y} r="7" fill="#100f0d" stroke="#C9A54C" strokeWidth="1.5" />
              <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill="#f4f1ea">
                {m.n}
              </text>
              <title>{`${m.n} ${unit}`}</title>
            </g>
          );
        })}
      <circle cx={start[0]} cy={start[1]} r="5" fill="#5fc49a" stroke="#0b0a07" strokeWidth="2">
        <title>Start</title>
      </circle>
      {!here && (
        <circle cx={end[0]} cy={end[1]} r="5" fill="#f08a8a" stroke="#0b0a07" strokeWidth="2">
          <title>Finish</title>
        </circle>
      )}
      {here && current && (
        <g data-testid="route-current">
          <circle cx={here[0]} cy={here[1]} r={Math.max(6, current.accuracy * scale)} fill="#6aa6ff" fillOpacity="0.15" stroke="#6aa6ff" strokeOpacity="0.5" />
          <circle cx={here[0]} cy={here[1]} r="4.5" fill="#6aa6ff" stroke="#0b0a07" strokeWidth="2" />
          <title>{`You are here (±${Math.round(current.accuracy)} m)`}</title>
        </g>
      )}
      <g transform={`translate(${W - pad - barPx} ${H - 12})`}>
        <line x1="0" y1="0" x2={barPx} y2="0" stroke="#a39a86" strokeWidth="2" />
        <text x={barPx / 2} y="-4" textAnchor="middle" fontSize="10" fill="#a39a86">
          {bar[1]}
        </text>
      </g>
      <text x={pad} y={H - 8} fontSize="10" fill="#a39a86">
        N ↑
      </text>
    </svg>
  );
}
