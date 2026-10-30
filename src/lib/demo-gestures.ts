/**
 * Finger interaction for the pre-rendered 2.5D demonstrations. The clips are filmed from one camera, so they cannot be
 * turned in 3D; instead a tap plays or pauses, a sideways drag moves through the rep frame by frame (the whole width of
 * the picture is one rep), and where an exercise has more than one camera view, a swipe on the view bar changes it.
 * Pure functions, so the gesture rules are tested without a browser.
 */

/** Movement (px) below which a touch is still a tap. */
export const TAP_SLOP = 10;
/** A tap is quicker than this (ms); a longer press that does not move does nothing. */
export const TAP_MS = 450;
/** Movement (px) before a touch is decided as a scrub or a page scroll. */
export const DECIDE_PX = 8;

export type DragIntent = "undecided" | "scrub" | "scroll";

/** Mostly sideways: scrub the rep. Mostly up or down: leave it to the page to scroll. */
export function dragIntent(dx: number, dy: number): DragIntent {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < DECIDE_PX && ay < DECIDE_PX) return "undecided";
  return ax > ay ? "scrub" : "scroll";
}

export function isTap(dx: number, dy: number, ms: number): boolean {
  return Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP && ms < TAP_MS;
}

/**
 * Where in the rep (0..1) a drag has reached: dragging the picture's full width moves through one whole rep, starting
 * from where the finger went down. A looping clip wraps round (its last frame meets its first); one that plays once
 * stops at either end.
 */
export function scrubFraction(start: number, dx: number, width: number, loops: boolean): number {
  const f = start + dx / Math.max(width, 1);
  if (loops) return ((f % 1) + 1) % 1;
  return Math.min(Math.max(f, 0), 0.999);
}

/** The scrub frame that shows fraction `f` of the rep. */
export function frameIndex(f: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.floor(f * count + 1e-9)));
}

/** Media time (s) inside a clip of `duration` seconds for the start of scrub frame `i` of `count`, nudged inside it. */
export function frameTime(i: number, count: number, duration: number): number {
  if (!(duration > 0) || count <= 0) return 0;
  return Math.min(duration - 0.01, (i / count) * duration + 0.01);
}

/** A swipe on the view bar: left for the next view, right for the previous; 0 when it is not a clear sideways swipe. */
export function swipeStep(dx: number, dy: number, ms: number): -1 | 0 | 1 {
  if (Math.abs(dx) < 40 || Math.abs(dx) < 1.5 * Math.abs(dy) || ms > 800) return 0;
  return dx < 0 ? 1 : -1;
}

export function nextView(current: number, step: number, total: number): number {
  if (total <= 0) return 0;
  return (((current + step) % total) + total) % total;
}
