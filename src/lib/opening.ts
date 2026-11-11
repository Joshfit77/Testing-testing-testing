/**
 * The opening (the gate animation) is the app's one entrance. It plays on every full load of the app: a fresh launch,
 * a reload, reopening the app after it was closed. It never plays on in-app navigation between Home, Train, Run, Food
 * and Faith, because it lives in the root layout, which stays mounted across client-side navigation.
 *
 * It is the only gate: whatever page it opens onto (the welcome page, sign-in, onboarding or Home) is the place
 * beyond the gate, so no page draws the gate again.
 *
 * Whether it plays is decided by OPENING_SCRIPT, inlined in <head>, before the first paint. That way the app never
 * flashes before the intro, and the intro never flashes on a page where it shouldn't play. The script also handles
 * Skip / Enter / Escape and the automatic finish, so the overlay works and goes away even before (or without) the
 * page's JavaScript bundle. The state lives on <html data-intro>: "play" → "entering" (Enter Narrow Gate, or the end of
 * the sequence: the camera moves through the doorway into the light) or "leaving" (Skip intro, Escape) → "done";
 * or "off".
 *
 * Launching the app opens "/" (the iPhone app's address). The server sends each person where they belong (the welcome
 * page, sign-in for someone who has signed in on this device before, onboarding, Home) and the middleware marks that
 * load as a launch (OPENING_LAUNCH_COOKIE), so the opening plays over the destination even when it is a page it
 * otherwise stays off (sign-in, onboarding). The mark is used once: a reload of that page doesn't replay it.
 *
 * It does not play:
 * - on sign-in, sign-up, password, legal, onboarding and admin pages (OPENING_SKIP_PATHS), unless the load is a launch;
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
/** After Enter Narrow Gate: the camera moves through the doorway into the light, then the light settles into the app. */
export const OPENING_ENTER_MS = 1500;
/** After Skip intro or Escape: a short fade. */
export const OPENING_LEAVE_MS = 350;
/**
 * The sequence waits (on black, as the launch screen is) for the gate's pictures for at most this long, so the door
 * doesn't open before it has been drawn on a slow connection; then it plays with whatever has arrived.
 */
export const OPENING_ART_WAIT_MS = 1200;
/** After the app comes back from the background while the opening was showing, it fades out instead of resuming. */
export const OPENING_AWAY_MS = 1000;

export const OPENING_SKIP_PATHS = /^\/(login|signup|forgot-password|reset-password|auth|legal|onboarding|api|admin|offline)(\/|$)/;
export const OPENING_CRITICAL_PATHS = /^\/(train\/workout|run\/record|progress\/body-scan\/new|nutrition\/scanner|progress\/sleep\/alarm)(\/|$)/;
/** Workout drafts (src/lib/workout-storage.ts) and GPS recordings (src/components/run/gps-recorder.tsx), per user. */
export const WORKOUT_DRAFT_PREFIX = "ngf.workout.draft.";
/** The member's list of workouts discarded on this device (src/lib/workout-storage.ts). */
export const WORKOUT_DISCARDED_PREFIX = "ngf.workout.discarded.";
export const GPS_RECORDING_PREFIX = "run.recording.";
/** A recording older than this can't be resumed (matches isResumable in src/lib/domain/gps-track.ts). */
export const GPS_RESUMABLE_MS = 12 * 3600_000;
/** The gate's pictures (scripts/opening/render_gate.py), loaded as soon as the intro is going to play. */
export const OPENING_IMAGES = ["/opening/gate-base.webp", "/opening/gate-light.webp", "/opening/gate-door.webp"];
/** Set to "1" in local storage by the browser tests (and the demo capture) to keep the intro out of the way. */
export const OPENING_TEST_FLAG = "ngf.e2e.noIntro";
/** The iPhone/Android app adds this to the web view's user agent (capacitor.config.ts, src/server/native.ts). */
export const NATIVE_APP_UA_TOKEN = "NarrowGateApp";
/**
 * Set by the middleware on the response to a launch (a full page load of "/"); read and removed by OPENING_SCRIPT on
 * the page the launch ends on. Short-lived, so a launch that never reaches a page leaves nothing behind.
 */
export const OPENING_LAUNCH_COOKIE = "ngf_gate";
export const OPENING_LAUNCH_COOKIE_MAX_AGE = 30;
/**
 * Set by the middleware once someone has signed in on this device. A launch while signed out then goes to sign-in
 * instead of the welcome page. A hint only (it opens no data), removed when the account is deleted.
 */
export const RETURNING_COOKIE = "ngf_member";

export type OpeningDecision = "play" | "off";

export interface OpeningEnv {
  path: string;
  hidden: boolean;
  /** Running inside the iPhone/Android app (NATIVE_APP_UA_TOKEN in the user agent). */
  native?: boolean;
  /** This load is the end of a launch (OPENING_LAUNCH_COOKIE was set). */
  launch?: boolean;
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
  if ((!env.launch && OPENING_SKIP_PATHS.test(env.path)) || OPENING_CRITICAL_PATHS.test(env.path) || (env.hidden && !env.native)) return "off";
  if (env.storage[OPENING_TEST_FLAG] === "1") return "off";
  return activityInProgress(env.storage, env.now) ? "off" : "play";
}

/**
 * Inline <head> script. Plain ES5 so it runs everywhere before the bundle; any error leaves the intro off.
 *
 * - Decides whether to play (decideOpening), consuming the launch mark.
 * - Loads the gate's pictures and holds the whole sequence, paused on black (html[data-intro-art="loading"]), until
 *   they have arrived and been decoded, for at most OPENING_ART_WAIT_MS; a picture that fails to load switches to the
 *   drawn fallback gate (data-intro-art="missing").
 * - Enter Narrow Gate ("entering"): finishes opening the door and brightening its light from wherever they are, so
 *   the camera never moves through a half-open door. One transition only: further presses, Skip and Escape are
 *   ignored once it has started.
 * - The exit animations (ngo-exit, ngo-enter-out, ngo-leave in globals.css) end in "done"; timers are the fallback.
 * - Coming back to the app after it went to the background mid-opening fades the opening out (no replay, no stall).
 */
export const OPENING_SCRIPT = `(function(){var d=document.documentElement,launch=false;try{launch=/(?:^|;\\s*)${OPENING_LAUNCH_COOKIE}=1(?:;|$)/.test(document.cookie||"");if(launch)document.cookie="${OPENING_LAUNCH_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax"}catch(e){}try{var p=location.pathname,s=window.localStorage,n=Date.now(),play=(launch||!${OPENING_SKIP_PATHS}.test(p))&&!${OPENING_CRITICAL_PATHS}.test(p)&&(document.visibilityState!=="hidden"||navigator.userAgent.indexOf(${JSON.stringify(NATIVE_APP_UA_TOKEN)})>=0);if(play&&s){if(s.getItem(${JSON.stringify(OPENING_TEST_FLAG)})==="1")play=false;for(var i=0;play&&i<s.length;i++){var k=s.key(i)||"",v=s.getItem(k);if(k.indexOf(${JSON.stringify(WORKOUT_DRAFT_PREFIX)})===0&&v)play=false;else if(k.indexOf(${JSON.stringify(GPS_RECORDING_PREFIX)})===0){try{var t=JSON.parse(v||"null");t=t&&t.track;if(t&&t.status!=="finished"&&typeof t.startedAt==="number"&&n-t.startedAt<${GPS_RESUMABLE_MS})play=false}catch(e){}}}}d.dataset.intro=play?"play":"off"}catch(e){d.dataset.intro="off"}if(d.dataset.intro!=="play")return;var gone=false,started=false;function done(){if(gone)return;gone=true;d.dataset.intro="done"}function start(){if(started)return;started=true;if(d.dataset.introArt==="loading")d.dataset.introArt="ready";setTimeout(done,${OPENING_FALLBACK_MS})}function go(state,ms){if(d.dataset.intro!=="play")return;d.dataset.intro=state;start();setTimeout(done,ms)}d.dataset.introArt="loading";try{var left=${OPENING_IMAGES.length},Img=window.Image;var settle=function(ok){if(!ok){d.dataset.introArt="missing";start()}if(--left<=0)start()};${JSON.stringify(OPENING_IMAGES)}.forEach(function(src){if(!Img){settle(true);return}var im=new Img(),once=false,fin=function(ok){if(once)return;once=true;settle(ok)};im.onload=function(){if(im.decode)im.decode().then(function(){fin(true)},function(){fin(true)});else fin(true)};im.onerror=function(){fin(false)};im.src=src})}catch(e){}setTimeout(start,${OPENING_ART_WAIT_MS});function finish(el,from,to,ms){try{if(!el||!el.animate)return;el.style.animation="none";el.animate([from,to],{duration:ms,easing:"cubic-bezier(0.2, 0.6, 0.3, 1)",fill:"forwards"})}catch(e){}}function finishGate(){try{var o=document.querySelector(".ngo"),dr=o&&o.querySelector(".ngs-door");if(!dr)return;var m=(getComputedStyle(dr).transform||"").match(/matrix3d\\(([^)]+)\\)/),a=0;if(m){var c=m[1].split(",");a=Math.atan2(-parseFloat(c[2]),parseFloat(c[0]))*180/Math.PI}if(a<79)finish(dr,{transform:"rotateY("+a.toFixed(2)+"deg)"},{transform:"rotateY(80deg)"},Math.round(120+(80-a)*5));[[".ngs-light",1],[".ngs-haze",0.85]].forEach(function(x){var el=o.querySelector(x[0]),op=el?parseFloat(getComputedStyle(el).opacity):1;if(el&&op<x[1]-0.01)finish(el,{opacity:op},{opacity:x[1]},450)})}catch(e){}}document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;if(t.closest("[data-intro-enter]")){if(d.dataset.intro==="play"){finishGate();go("entering",${OPENING_ENTER_MS + 300})}}else if(t.closest("[data-intro-dismiss]"))go("leaving",${OPENING_LEAVE_MS + 150})},true);document.addEventListener("keydown",function(e){if(e.key==="Escape")go("leaving",${OPENING_LEAVE_MS + 150})});document.addEventListener("animationend",function(e){var n=e.animationName;if(n==="ngo-exit"||n==="ngo-leave"||n==="ngo-enter-out")done()},true);var seen=document.visibilityState!=="hidden",away=0;document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden"){if(seen)away=Date.now()}else{seen=true;if(away&&Date.now()-away>${OPENING_AWAY_MS})go("leaving",${OPENING_LEAVE_MS + 150});away=0}})})();`;
