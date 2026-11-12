/**
 * Morning and daily check-ins (Sleep & Recovery, Stage B5): the fields, their labels, and the "on nights when…"
 * comparisons between what the member reported and how they slept. Comparisons are associations in the member's own
 * data; they never claim a cause.
 */
import type { NightSummary } from "@/lib/domain/sleep";

export const RATING_FIELDS = ["restedness", "energy_morning", "energy_afternoon", "energy_evening", "mood", "stress", "sleep_quality"] as const;
export type RatingField = (typeof RATING_FIELDS)[number];

export const RATING_LABELS: Record<RatingField, { label: string; low: string; high: string }> = {
  restedness: { label: "How rested do you feel?", low: "Exhausted", high: "Fully rested" },
  sleep_quality: { label: "How was your sleep?", low: "Terrible", high: "Great" },
  energy_morning: { label: "Morning energy", low: "Drained", high: "Energized" },
  energy_afternoon: { label: "Afternoon energy", low: "Drained", high: "Energized" },
  energy_evening: { label: "Evening energy", low: "Drained", high: "Energized" },
  mood: { label: "Mood", low: "Low", high: "Great" },
  stress: { label: "Stress", low: "Calm", high: "Very stressed" },
};

export const EXERCISE_TIMINGS = ["none", "morning", "afternoon", "evening"] as const;
export type ExerciseTiming = (typeof EXERCISE_TIMINGS)[number];
export const EXERCISE_TIMING_LABELS: Record<ExerciseTiming, string> = { none: "No training", morning: "Morning", afternoon: "Afternoon", evening: "Evening" };

export const DISTURBANCES = ["noise", "light", "heat", "cold", "partner", "pet", "child", "pain", "bathroom", "worry", "other"] as const;
export type Disturbance = (typeof DISTURBANCES)[number];
export const DISTURBANCE_LABELS: Record<Disturbance, string> = {
  noise: "Noise",
  light: "Light",
  heat: "Too warm",
  cold: "Too cold",
  partner: "Partner",
  pet: "Pet",
  child: "Child",
  pain: "Pain or discomfort",
  bathroom: "Bathroom trips",
  worry: "Worry or racing mind",
  other: "Something else",
};

/** Caffeine at or after this clock time counts as "late". */
export const LATE_CAFFEINE_MINUTES = 14 * 60;

export interface SleepCheckin {
  day: string;
  restedness: number | null;
  energy_morning: number | null;
  energy_afternoon: number | null;
  energy_evening: number | null;
  mood: number | null;
  stress: number | null;
  sleep_quality: number | null;
  /** "HH:MM" or null. */
  caffeine_last: string | null;
  alcohol: boolean | null;
  late_meal: boolean | null;
  exercise_timing: ExerciseTiming | null;
  evening_screens: boolean | null;
  disturbances: Disturbance[];
  travel: boolean | null;
  sleep_aid: string | null;
  notes: string | null;
}

export function isEmptyCheckin(c: SleepCheckin): boolean {
  return (
    RATING_FIELDS.every((f) => c[f] === null) &&
    c.caffeine_last === null &&
    c.alcohol === null &&
    c.late_meal === null &&
    c.exercise_timing === null &&
    c.evening_screens === null &&
    c.disturbances.length === 0 &&
    c.travel === null &&
    !c.sleep_aid &&
    !c.notes
  );
}

export function clockToMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export type FactorKey = "alcohol" | "late_meal" | "evening_screens" | "late_caffeine" | "travel" | "evening_exercise" | "disturbed";

export const FACTOR_TEXT: Record<FactorKey, string> = {
  alcohol: "after alcohol",
  late_meal: "after a late meal",
  evening_screens: "after evening screen time",
  late_caffeine: "after caffeine from 2 PM on",
  travel: "while travelling or off your usual schedule",
  evening_exercise: "after evening training",
  disturbed: "with a disturbance you noted",
};

/** Whether a factor applied the night ending on the check-in's day; null when it wasn't answered. */
export function factorPresent(c: SleepCheckin, key: FactorKey): boolean | null {
  switch (key) {
    case "alcohol":
      return c.alcohol;
    case "late_meal":
      return c.late_meal;
    case "evening_screens":
      return c.evening_screens;
    case "travel":
      return c.travel;
    case "late_caffeine": {
      const m = clockToMinutes(c.caffeine_last);
      return m === null ? null : m >= LATE_CAFFEINE_MINUTES;
    }
    case "evening_exercise":
      return c.exercise_timing === null ? null : c.exercise_timing === "evening";
    case "disturbed":
      return c.disturbances.length > 0 ? true : null;
  }
}

export interface Association {
  key: FactorKey;
  /** Nights where the factor applied, and nights where the member said it didn't. */
  withCount: number;
  withoutCount: number;
  /** Average minutes asleep, with minus without. */
  asleepDeltaMinutes: number;
  /** Average restedness (1–5), with minus without; null when restedness wasn't rated on enough nights. */
  restednessDelta: number | null;
}

/** Nights needed on each side before a comparison is shown. */
export const MIN_NIGHTS_PER_SIDE = 3;

/**
 * Compare nights with and without each reported factor. Only factors with at least three nights on each side are
 * returned, and only differences of 15+ minutes or 0.5+ rating points, so a single odd night can't make a claim.
 */
export function associations(nights: NightSummary[], checkins: SleepCheckin[]): Association[] {
  const byDay = new Map(checkins.map((c) => [c.day, c]));
  const out: Association[] = [];
  for (const key of Object.keys(FACTOR_TEXT) as FactorKey[]) {
    const withN: { asleep: number; rested: number | null }[] = [];
    const withoutN: { asleep: number; rested: number | null }[] = [];
    for (const n of nights) {
      const c = byDay.get(n.nightOf);
      if (!c) continue;
      const present = factorPresent(c, key);
      if (present === null) {
        // Disturbances are only ever noted when present: a check-in without any counts as "none noted".
        if (key === "disturbed") withoutN.push({ asleep: n.asleepMinutes, rested: c.restedness });
        continue;
      }
      (present ? withN : withoutN).push({ asleep: n.asleepMinutes, rested: c.restedness });
    }
    if (withN.length < MIN_NIGHTS_PER_SIDE || withoutN.length < MIN_NIGHTS_PER_SIDE) continue;
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const asleepDelta = Math.round(avg(withN.map((x) => x.asleep)) - avg(withoutN.map((x) => x.asleep)));
    const rw = withN.flatMap((x) => (x.rested === null ? [] : [x.rested]));
    const ro = withoutN.flatMap((x) => (x.rested === null ? [] : [x.rested]));
    const restednessDelta = rw.length >= MIN_NIGHTS_PER_SIDE && ro.length >= MIN_NIGHTS_PER_SIDE ? Math.round((avg(rw) - avg(ro)) * 10) / 10 : null;
    if (Math.abs(asleepDelta) < 15 && (restednessDelta === null || Math.abs(restednessDelta) < 0.5)) continue;
    out.push({ key, withCount: withN.length, withoutCount: withoutN.length, asleepDeltaMinutes: asleepDelta, restednessDelta });
  }
  return out.sort((a, b) => Math.abs(b.asleepDeltaMinutes) - Math.abs(a.asleepDeltaMinutes));
}

/** One plain sentence per association. Says "on nights", never "because". */
export function describeAssociation(a: Association): string {
  const mins = Math.abs(a.asleepDeltaMinutes);
  const sleep = mins >= 15 ? `slept ${mins} min ${a.asleepDeltaMinutes < 0 ? "less" : "more"}` : "slept about the same";
  const rested = a.restednessDelta === null ? "" : Math.abs(a.restednessDelta) >= 0.5 ? ` and felt ${a.restednessDelta < 0 ? "less" : "more"} rested (${Math.abs(a.restednessDelta)} points)` : " and felt about as rested";
  return `On ${a.withCount} nights ${FACTOR_TEXT[a.key]}, you ${sleep}${rested} than on ${a.withoutCount} nights without. That's a pattern in your own entries, not proof of a cause.`;
}
