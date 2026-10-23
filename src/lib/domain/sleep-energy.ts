/**
 * Estimated daily energy rhythm, version 1 (Sleep & Recovery, Stage C2). An hour-by-hour estimate from two stated
 * assumptions (sleep pressure builds through the day; alertness has a morning rise, an early-afternoon dip and an
 * evening wind-down) scaled by last night's sleep and the estimated sleep debt. It is a sketch to plan around, not
 * a measurement of hormones, brain activity or circadian timing, and it is shown next to what the member actually
 * reported. Method: docs/SLEEP_METHOD.md.
 */

export const SLEEP_ENERGY_VERSION = 1;

export interface EnergyPoint {
  /** Clock minutes since midnight at the start of the hour. */
  minute: number;
  /** 0–100, or null while the member is expected to be asleep. */
  level: number | null;
}

export interface EnergyRhythm {
  version: typeof SLEEP_ENERGY_VERSION;
  points: EnergyPoint[];
  /** Hour ranges (clock minutes) where the estimate is at its highest and lowest. */
  peaks: { start: number; end: number }[];
  dips: { start: number; end: number }[];
  /** Suggested start of winding down (an hour before the bed window). */
  windDown: number;
  /** Multiplier applied for short sleep and debt, for the explanation. */
  scale: number;
  assumptions: string[];
}

export const ENERGY_ASSUMPTIONS = [
  "Alertness is highest two to five hours after waking and falls as the day goes on (sleep pressure).",
  "A dip arrives six to eight hours after waking (the early-afternoon slump), then a smaller second wind before the evening wind-down.",
  "A short night and an estimated sleep debt lower the whole curve; they don't move it.",
  "Caffeine, light, meals and training all shift the real curve; the estimate ignores them.",
];

const wrap = (m: number) => ((Math.round(m) % 1440) + 1440) % 1440;

/**
 * @param wakeMinutes clock minutes of waking (anchor of the day)
 * @param bedMinutes clock minutes of the intended bedtime
 * @param lastNightAsleep minutes asleep last night (null when not logged)
 * @param goalMinutes the member's sleep goal
 * @param debtMinutes estimated sleep debt (0 when unknown)
 */
export function energyRhythm(wakeMinutes: number, bedMinutes: number, lastNightAsleep: number | null, goalMinutes: number, debtMinutes = 0): EnergyRhythm {
  const awakeMinutes = wrap(bedMinutes - wakeMinutes) || 960;
  // Short sleep: up to −20%; debt: up to −20% at 8 hours behind. Never below 60% of the rested curve.
  const shortSleep = lastNightAsleep === null ? 0 : Math.max(0, 1 - lastNightAsleep / goalMinutes);
  const scale = Math.max(0.6, 1 - Math.min(0.2, shortSleep) - Math.min(0.2, (Math.max(0, debtMinutes) / 480) * 0.2));
  const points: EnergyPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const minute = h * 60;
    const since = wrap(minute + 30 - wakeMinutes);
    if (since >= awakeMinutes) {
      points.push({ minute, level: null });
      continue;
    }
    const t = since / 60;
    // Sleep pressure: 100 at waking down to 55 after 16 hours.
    const pressure = 100 - (45 * t) / 16;
    // Morning rise (slow start in the first two hours), afternoon dip, evening wind-down in the last two hours.
    const rise = -25 * Math.exp(-Math.pow(t / 1.6, 2));
    const dip = -14 * Math.exp(-Math.pow((t - 7) / 1.4, 2));
    const remaining = (awakeMinutes - since) / 60;
    const windDown = remaining < 2 ? -12 * (2 - remaining) : 0;
    const level = Math.round(Math.max(0, Math.min(100, (pressure + rise + dip + windDown) * scale)));
    points.push({ minute, level });
  }
  // The waking day in order from waking, so ranges can cross midnight.
  const awake = points
    .filter((p) => p.level !== null)
    .map((p) => ({ minute: p.minute, level: p.level as number, since: wrap(p.minute + 30 - wakeMinutes) }))
    .sort((a, b) => a.since - b.since);
  const max = Math.max(...awake.map((p) => p.level));
  const peaks: { start: number; end: number; last: number }[] = [];
  let cur: { start: number; end: number; last: number } | null = null;
  for (const p of awake) {
    if (p.level < max - 6) continue;
    if (cur && p.since === cur.last + 60) {
      cur.end = p.minute + 60;
      cur.last = p.since;
    } else peaks.push((cur = { start: p.minute, end: p.minute + 60, last: p.since }));
  }
  // Dips are local lows (not the final wind-down), widened to the neighbouring hours that are nearly as low.
  const dips: { start: number; end: number }[] = [];
  for (let k = 1; k < awake.length - 1; k++) {
    const prev = awake[k - 1]!;
    const p = awake[k]!;
    const next = awake[k + 1]!;
    if (!(p.level < prev.level && p.level <= next.level && p.level < max - 15 && awakeMinutes - p.since >= 150)) continue;
    let s = k;
    let e = k;
    while (s > 0 && awake[s - 1]!.level <= p.level + 4) s--;
    while (e < awake.length - 1 && awake[e + 1]!.level <= p.level + 4) e++;
    dips.push({ start: wrap(awake[s]!.minute), end: wrap(awake[e]!.minute + 60) });
    k = e;
  }
  return {
    version: SLEEP_ENERGY_VERSION,
    points,
    peaks: peaks.map((r) => ({ start: wrap(r.start), end: wrap(r.end) })),
    dips,
    windDown: wrap(bedMinutes - 60),
    scale: Math.round(scale * 100) / 100,
    assumptions: ENERGY_ASSUMPTIONS,
  };
}
