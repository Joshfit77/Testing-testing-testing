/**
 * The Home hero's background: one picture for each day of the week, Monday to Sunday, each pairing a Christian symbol
 * with training. Pure data and date maths, shared by the server page (first paint) and the client hero (which follows
 * the device's own clock: midnight, app resume, a change of time zone, and offline).
 *
 * The pictures are original artwork rendered by scripts/home-backgrounds (see docs/design/HOME_BACKGROUNDS.md, which
 * also specifies drop-in photographic replacements). To replace one, put a file with the same name in
 * public/home-backgrounds and bump HOME_BACKGROUND_VERSION.
 */
export interface HomeBackground {
  /** Lower-case English weekday: also the file name. */
  key: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
  /** The day's theme, shown as a short line above the greeting. */
  theme: string;
  /** What the picture shows (for documentation and tests; the picture itself is decorative). */
  scene: string;
  src: string;
}

/** Bump when a picture changes, so phones and the service worker fetch the new file. */
export const HOME_BACKGROUND_VERSION = 1;

const make = (key: HomeBackground["key"], theme: string, scene: string): HomeBackground => ({ key, theme, scene, src: `/home-backgrounds/${key}.webp?v=${HOME_BACKGROUND_VERSION}` });

/** Indexed like Date#getDay(): 0 = Sunday … 6 = Saturday. */
export const HOME_BACKGROUNDS: readonly HomeBackground[] = [
  make("sunday", "Rest and worship", "A quiet gym in morning light: an arched window, a bench and a closed Bible."),
  make("monday", "Strength through Christ", "A tall cross, backlit, with a loaded barbell and a kettlebell at its foot."),
  make("tuesday", "Discipline", "A squat rack with a racked barbell, and a cross of light in the wall behind it."),
  make("wednesday", "Faith first", "An open Bible on a gym bench in a shaft of light."),
  make("thursday", "The narrow gate", "An athlete walking toward a tall, narrow doorway filled with light."),
  make("friday", "Perseverance", "An athlete kneeling in prayer beside a loaded barbell."),
  make("saturday", "Endurance", "A runner on a mountain ridge at first light, with a cross on the summit ahead."),
];

/** Day of the week (0 = Sunday … 6 = Saturday) of a calendar date written YYYY-MM-DD. */
export function weekdayOfIsoDate(isoDate: string): number {
  const t = Date.parse(`${isoDate}T12:00:00Z`);
  return Number.isNaN(t) ? 0 : new Date(t).getUTCDay();
}

/** The background for a calendar date (YYYY-MM-DD). */
export function homeBackgroundForDate(isoDate: string): HomeBackground {
  return HOME_BACKGROUNDS[weekdayOfIsoDate(isoDate)]!;
}

/** The device's own calendar date, YYYY-MM-DD, from its clock and time zone (works offline). */
export function deviceIsoDate(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Milliseconds from `now` until just after the device's next local midnight (DST-safe: built from local date parts). */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}
