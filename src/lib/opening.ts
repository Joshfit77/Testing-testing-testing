/**
 * The opening (the gate animation) plays on every full load of the app: a fresh launch, a reload, reopening the app
 * after it was closed. It never plays on in-app navigation between Home, Train, Run, Food and Faith, because it
 * lives in the root layout, which stays mounted across client-side navigation.
 *
 * Whether it plays is decided by OPENING_SCRIPT, inlined in <head>, before the first paint. That way the app never
 * flashes before the intro, and the intro never flashes on a page where it shouldn't play. The script also handles
 * Skip / Enter / Escape and the automatic finish, so the overlay works and goes away even before (or without) the
 * page's JavaScript bundle. The state lives on <html data-intro>: "play" → "entering" (Enter Narrow Gate, or the end of
 * the sequence: the camera moves through the doorway into the light) or "leaving" (Skip intro, Escape) → "done";
 * or "off".
 *
 * It does not play:
 * - on sign-in, sign-up, password, legal, onboarding and admin pages (OPENING_SKIP_PATHS);
 * - when the page is a live activity that a reload must drop you straight back into: an active workout, GPS
 *   recording, the body-scan camera, the barcode scanner, the smart alarm (OPENING_CRITICAL_PATHS);
 * - when a workout or GPS recording is in progress on this device, whatever the page (both survive reloads);
 * - when the page loads in a background browser tab. Inside the iPhone/Android app a full page load only happens
 *   when the app is opened, relaunched or reloaded, so there the page always counts as in front (a web view can
 *   report "hidden" while the app is still starting up);
 * - when the browser-test flag is set (OPENING_TEST_FLAG), so the rest of the end-to-end suite can work with pages.
 *
 * Reduced motion (the device setting or the in-app one) shows the same screen without movement, see globals.css.
 */

/** Total length of the opening when left alone: the move into the light starts at 3.85 s; the app is in by ~5 s. */
export const OPENING_MS = 5050;
/** Fallback in case the end of the last animation is never observed (e.g. animations disabled by the browser). */
export const OPENING_FALLBACK_MS = 5600;
/** After Enter Narrow Gate: the move into the light, then the app fades in. */
export const OPENING_ENTER_MS = 1220;
/** After Skip intro or Escape: a short fade. */
export const OPENING_LEAVE_MS = 350;

export const OPENING_SKIP_PATHS = /^\/(login|signup|forgot-password|reset-password|auth|legal|onboarding|api|admin|offline)(\/|$)/;
export const OPENING_CRITICAL_PATHS = /^\/(train\/workout|run\/record|progress\/body-scan\/new|nutrition\/scanner|progress\/sleep\/alarm)(\/|$)/;
/** Workout drafts (src/lib/workout-storage.ts) and GPS recordings (src/components/run/gps-recorder.tsx), per user. */
export const WORKOUT_DRAFT_PREFIX = "ngf.workout.draft.";
export const GPS_RECORDING_PREFIX = "run.recording.";
/** A recording older than this can't be resumed (matches isResumable in src/lib/domain/gps-track.ts). */
export const GPS_RESUMABLE_MS = 12 * 3600_000;
/** The gate's pictures (scripts/opening/render_gate.py), preloaded as soon as the intro is going to play. */
export const OPENING_IMAGES = ["/opening/gate-base.webp", "/opening/gate-light.webp", "/opening/gate-door.webp"];
/** Set to "1" in local storage by the browser tests (and the demo capture) to keep the intro out of the way. */
export const OPENING_TEST_FLAG = "ngf.e2e.noIntro";
/** The iPhone/Android app adds this to the web view's user agent (capacitor.config.ts, src/server/native.ts). */
export const NATIVE_APP_UA_TOKEN = "NarrowGateApp";

export type OpeningDecision = "play" | "off";

export interface OpeningEnv {
  path: string;
  hidden: boolean;
  /** Running inside the iPhone/Android app (NATIVE_APP_UA_TOKEN in the user agent). */
  native?: boolean;
  now: number;
  /** Local storage entries (key → value). */
  storage: Record<string, string>;
}

/** True when a workout or a resumable GPS recording is in progress on this device. */
export function activityInProgress(storage: Record<string, string>, now: number): boolean {
  for (const [key, value] of Object.entries(storage)) {
    if (key.startsWith(WORKOUT_DRAFT_PREFIX) && value) return true;
    if (key.startsWith(GPS_RECORDING_PREFIX)) {
      try {
        const track = (JSON.parse(value) as { track?: { status?: string; startedAt?: number } } | null)?.track;
        if (track && track.status !== "finished" && typeof track.startedAt === "number" && now - track.startedAt < GPS_RESUMABLE_MS) return true;
      } catch {
        /* unreadable: not an activity */
      }
    }
  }
  return false;
}

/** The rule OPENING_SCRIPT applies (kept in step with it by tests/unit/opening.test.ts). */
export function decideOpening(env: OpeningEnv): OpeningDecision {
  if (OPENING_SKIP_PATHS.test(env.path) || OPENING_CRITICAL_PATHS.test(env.path) || (env.hidden && !env.native)) return "off";
  if (env.storage[OPENING_TEST_FLAG] === "1") return "off";
  return activityInProgress(env.storage, env.now) ? "off" : "play";
}

/**
 * Inline <head> script. Plain ES5 so it runs everywhere before the bundle; any error leaves the intro off.
 * The exit animations (ngo-exit, ngo-leave in globals.css) end in "done"; a timer is the fallback.
 */
export const OPENING_SCRIPT = `(function(){var d=document.documentElement;try{var p=location.pathname,s=window.localStorage,n=Date.now(),play=!${OPENING_SKIP_PATHS}.test(p)&&!${OPENING_CRITICAL_PATHS}.test(p)&&(document.visibilityState!=="hidden"||navigator.userAgent.indexOf(${JSON.stringify(NATIVE_APP_UA_TOKEN)})>=0);if(play&&s){if(s.getItem(${JSON.stringify(OPENING_TEST_FLAG)})==="1")play=false;for(var i=0;play&&i<s.length;i++){var k=s.key(i)||"",v=s.getItem(k);if(k.indexOf(${JSON.stringify(WORKOUT_DRAFT_PREFIX)})===0&&v)play=false;else if(k.indexOf(${JSON.stringify(GPS_RECORDING_PREFIX)})===0){try{var t=JSON.parse(v||"null");t=t&&t.track;if(t&&t.status!=="finished"&&typeof t.startedAt==="number"&&n-t.startedAt<${GPS_RESUMABLE_MS})play=false}catch(e){}}}}d.dataset.intro=play?"play":"off"}catch(e){d.dataset.intro="off"}if(d.dataset.intro!=="play")return;${OPENING_IMAGES.map((src) => `var l=document.createElement("link");l.rel="preload";l.as="image";l.href=${JSON.stringify(src)};document.head.appendChild(l);`).join("")}var gone=false;function done(){if(gone)return;gone=true;d.dataset.intro="done"}function go(state,ms){if(d.dataset.intro!=="play")return;d.dataset.intro=state;setTimeout(done,ms)}document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;if(t.closest("[data-intro-enter]"))go("entering",${OPENING_ENTER_MS + 300});else if(t.closest("[data-intro-dismiss]"))go("leaving",${OPENING_LEAVE_MS + 150})},true);document.addEventListener("keydown",function(e){if(e.key==="Escape")go("leaving",${OPENING_LEAVE_MS + 150})});document.addEventListener("animationend",function(e){var n=e.animationName;if(n==="ngo-exit"||n==="ngo-leave"||n==="ngo-enter-out")done()},true);setTimeout(done,${OPENING_FALLBACK_MS})})();`;
