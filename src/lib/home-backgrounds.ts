/**
 * The Home hero's background: one photograph for each day of the week. Pure data and date maths, shared by the server
 * page (first paint) and the client hero (which follows the device's own clock: midnight, app resume, a change of time
 * zone, and offline).
 *
 * The photographs are supplied and approved by the owner (docs/design/HOME_BACKGROUNDS.md): real, cinematic
 * photography, never drawn or generated-looking artwork. Until all seven are in public/home-backgrounds,
 * HOME_BACKGROUND_PHOTOS_READY stays false and the hero shows a plain dark panel; the rotation, the theme line, the
 * caching and the offline support all keep working and are ready for the files.
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

/**
 * True once the seven approved photographs are in public/home-backgrounds. False: no picture is requested or shown.
 * (The first set, drawn by code, was rejected by the owner on 2026-11-15 and removed.)
 */
export const HOME_BACKGROUND_PHOTOS_READY: boolean = false;

const make = (key: HomeBackground["key"], theme: string, scene: string): HomeBackground => ({ key, theme, scene, src: `/home-backgrounds/${key}.webp?v=${HOME_BACKGROUND_VERSION}` });

/** Indexed like Date#getDay(): 0 = Sunday … 6 = Saturday. Scenes are the owner's brief of 2026-11-15. */
export const HOME_BACKGROUNDS: readonly HomeBackground[] = [
  make("sunday", "The cross", "A real wooden cross on a hillside at sunrise."),
  make("monday", "Strength", "A muscular athlete training in a dark, realistic gym."),
  make("tuesday", "Faith first", "An open Bible beside gym equipment in natural window light."),
  make("wednesday", "Prayer", "An athlete praying alone in a quiet gym."),
  make("thursday", "Endurance", "A runner climbing a rugged mountain trail at sunrise."),
  make("friday", "Perseverance", "An athlete boxing or strength training in dramatic, natural light."),
  make("saturday", "Rest and worship", "A peaceful church interior with sunlight coming through the windows."),
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
