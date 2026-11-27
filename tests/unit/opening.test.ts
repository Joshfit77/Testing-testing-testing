import { readFileSync } from "node:fs";
import {
  decideOpening,
  NATIVE_APP_UA_TOKEN,
  OPENING_ART_WAIT_MS,
  OPENING_AWAY_MS,
  OPENING_FALLBACK_MS,
  OPENING_IMAGES,
  OPENING_LAUNCH_COOKIE,
  OPENING_SCRIPT,
  OPENING_TEST_FLAG,
  type OpeningEnv,
} from "@/lib/opening";

type Listener = (e: { key?: string; animationName?: string; target?: unknown }) => void;

/** A fake element for the gate's door, light and haze: records what the script asks it to animate. */
function fakeEl(computed: Record<string, string>) {
  const animated: { keyframes: Record<string, unknown>[]; duration: number }[] = [];
  return {
    style: {} as Record<string, string>,
    computed,
    animated,
    animate: (keyframes: Record<string, unknown>[], opts: { duration: number }) => animated.push({ keyframes, duration: opts.duration }),
    querySelector: (_sel: string): unknown => null,
  };
}

/** Runs the real inline head script against a fake page and returns its state machine. */
function runScript(env: OpeningEnv, opts: { cookie?: string; door?: ReturnType<typeof fakeEl>; light?: ReturnType<typeof fakeEl> } = {}) {
  const keys = Object.keys(env.storage);
  const listeners: Record<string, Listener[]> = {};
  const timers: { fn: () => void; ms: number }[] = [];
  const documentElement = { dataset: {} as Record<string, string> };
  const images: { src: string; onload?: () => void; onerror?: () => void }[] = [];
  class FakeImage {
    src = "";
    onload?: () => void;
    onerror?: () => void;
    constructor() {
      images.push(this);
    }
  }
  const overlay = fakeEl({});
  overlay.querySelector = (sel: string) => (sel === ".ngs-door" ? opts.door : sel === ".ngs-light" ? opts.light : null) ?? null;
  let cookie = opts.cookie ?? "";
  const cookieWrites: string[] = [];
  const document = {
    documentElement,
    visibilityState: env.hidden ? "hidden" : "visible",
    addEventListener: (type: string, fn: Listener) => (listeners[type] ??= []).push(fn),
    querySelector: (sel: string) => (sel === ".ngo" && (opts.door || opts.light) ? overlay : null),
    get cookie() {
      return cookie;
    },
    set cookie(v: string) {
      cookieWrites.push(v);
      if (/Max-Age=0/.test(v)) cookie = cookie.replace(new RegExp(`(^|;\\s*)${v.split("=")[0]}=[^;]*`), "");
    },
  };
  const window = {
    localStorage: { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => env.storage[k] ?? null },
    Image: FakeImage,
  };
  const getComputedStyle = (el: ReturnType<typeof fakeEl>) => el.computed;
  const realNow = Date.now;
  Date.now = () => env.now;
  try {
    const navigator = { userAgent: env.native ? `Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 ${NATIVE_APP_UA_TOKEN}` : "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Safari/604.1" };
    new Function("location", "document", "window", "setTimeout", "navigator", "getComputedStyle", OPENING_SCRIPT)(
      { pathname: env.path },
      document,
      window,
      (fn: () => void, ms: number) => timers.push({ fn, ms }),
      navigator,
      getComputedStyle,
    );
  } finally {
    Date.now = realNow;
  }
  const fire = (type: string, e: Parameters<Listener>[0]) => listeners[type]?.forEach((fn) => fn(e));
  return {
    state: () => documentElement.dataset.intro,
    art: () => documentElement.dataset.introArt,
    fire,
    timers,
    listeners,
    images,
    cookieWrites,
    setVisibility: (v: "hidden" | "visible") => {
      document.visibilityState = v;
      fire("visibilitychange", {});
    },
    loadAll: () => images.forEach((im) => im.onload?.()),
  };
}

const NOW = Date.UTC(2026, 9, 24, 12);
const env = (path: string, storage: Record<string, string> = {}, hidden = false, native = false, launch = false): OpeningEnv => ({ path, storage, hidden, native, launch, now: NOW });
const LAUNCH = `${OPENING_LAUNCH_COOKIE}=1`;
const recording = (status: string, ageMs: number) => JSON.stringify({ track: { version: 2, status, startedAt: NOW - ageMs }, guidedDayId: null });

describe("opening: when it plays", () => {
  const cases: [string, OpeningEnv, "play" | "off"][] = [
    ["the welcome page", env("/"), "play"],
    ["Home", env("/home"), "play"],
    ["Home opened from the home-screen icon", env("/home"), "play"],
    ["a deep screen (exercise library)", env("/train/exercises"), "play"],
    ["Faith", env("/faith"), "play"],
    ["Profile and billing", env("/profile/billing"), "play"],
    ["sign-in", env("/login"), "off"],
    ["sign-up", env("/signup"), "off"],
    ["password reset", env("/reset-password"), "off"],
    ["the email link landing", env("/auth/confirm"), "off"],
    ["legal pages", env("/legal/privacy"), "off"],
    ["onboarding", env("/onboarding"), "off"],
    ["the workout logger", env("/train/workout"), "off"],
    ["the GPS recorder", env("/run/record"), "off"],
    ["the body-scan camera", env("/progress/body-scan/new"), "off"],
    ["the barcode scanner", env("/nutrition/scanner"), "off"],
    ["the smart alarm", env("/progress/sleep/alarm"), "off"],
    ["a background tab", env("/home", {}, true), "off"],
    ["the iPhone app starting up (the web view still reports hidden)", env("/", {}, true, true), "play"],
    ["the iPhone app, in front", env("/home", {}, false, true), "play"],
    ["the iPhone app on the sign-in page", env("/login", {}, true, true), "off"],
    ["the iPhone app with a workout in progress", env("/home", { "ngf.workout.draft.user-1": "{\"name\":\"Day A\"}" }, true, true), "off"],
    ["the browser-test flag", env("/home", { [OPENING_TEST_FLAG]: "1" }), "off"],
    ["a workout in progress (any page)", env("/home", { "ngf.workout.draft.user-1": "{\"name\":\"Day A\"}" }), "off"],
    ["a GPS recording in progress", env("/faith", { "run.recording.user-1": recording("recording", 20 * 60_000) }), "off"],
    ["a paused GPS recording", env("/home", { "run.recording.user-1": recording("paused", 60 * 60_000) }), "off"],
    ["a finished GPS recording left behind", env("/home", { "run.recording.user-1": recording("finished", 60_000) }), "play"],
    ["a recording too old to resume", env("/home", { "run.recording.user-1": recording("recording", 13 * 3600_000) }), "play"],
    ["an unreadable recording", env("/home", { "run.recording.user-1": "{oops" }), "play"],
    ["unrelated storage", env("/home", { "ngf.textSize": "large", "ngf.scroll./home": "120" }), "play"],
    ["a path that only starts like an excluded one", env("/loginhelp"), "play"],
    // A launch (the app opened at "/") plays over wherever the server sent it, sign-in and onboarding included.
    ["a launch that ends on sign-in (signed out on a device used before)", env("/login", {}, false, true, true), "play"],
    ["a launch that ends on onboarding (unfinished)", env("/onboarding", {}, false, true, true), "play"],
    ["a launch that ends on Home", env("/home", {}, false, true, true), "play"],
    ["a launch still stays off a live activity", env("/train/workout", {}, false, true, true), "off"],
    ["a launch with a workout in progress", env("/home", { "ngf.workout.draft.user-1": "{\"name\":\"Day A\"}" }, false, true, true), "off"],
    ["a launch with the browser-test flag", env("/login", { [OPENING_TEST_FLAG]: "1" }, false, false, true), "off"],
  ];
  it.each(cases)("%s", (_name, e, expected) => {
    expect(decideOpening(e)).toBe(expected);
    // The shipped inline script agrees with the documented rule.
    expect(runScript(e, { cookie: e.launch ? `theme=dark; ${LAUNCH}` : "theme=dark" }).state()).toBe(expected);
  });

  it("uses the launch mark once: it is removed, so a reload of the same page doesn't replay the opening", () => {
    const first = runScript(env("/login"), { cookie: LAUNCH });
    expect(first.state()).toBe("play");
    expect(first.cookieWrites).toEqual([`${OPENING_LAUNCH_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`]);
    expect(runScript(env("/login"), { cookie: "" }).state()).toBe("off");
    // Another cookie with a similar name is not the mark.
    expect(runScript(env("/login"), { cookie: `x${OPENING_LAUNCH_COOKIE}=1` }).state()).toBe("off");
  });

  it("leaves the intro off if storage is unavailable", () => {
    const listeners: string[] = [];
    const documentElement = { dataset: {} as Record<string, string> };
    const document = { documentElement, visibilityState: "visible", addEventListener: (t: string) => listeners.push(t) };
    const window = {
      get localStorage(): never {
        throw new Error("blocked");
      },
    };
    new Function("location", "document", "window", "setTimeout", "navigator", OPENING_SCRIPT)({ pathname: "/home" }, { ...document, cookie: "" }, window, () => 0, { userAgent: "" });
    expect(documentElement.dataset.intro).toBe("off");
    expect(listeners).toEqual([]);
  });
});

it("recognises the app by the same user-agent token the native shells add", () => {
  expect(readFileSync("capacitor.config.ts", "utf8")).toContain(`appendUserAgent: "${NATIVE_APP_UA_TOKEN}"`);
});

describe("opening: how it ends", () => {
  const dismiss = { closest: (sel: string) => (sel === "[data-intro-dismiss]" ? {} : null) };
  const enter = { closest: (sel: string) => (sel === "[data-intro-enter]" ? {} : null) };
  const elsewhere = { closest: () => null };

  it("loads the gate's pictures only when it is going to play, and waits for them before the sequence starts", () => {
    const s = runScript(env("/home"));
    expect(s.images.map((im) => im.src)).toEqual(OPENING_IMAGES);
    // Held on black until the pictures have arrived: the fallback timer for the end isn't running yet.
    expect(s.art()).toBe("loading");
    expect(s.timers.some((t) => t.ms === OPENING_FALLBACK_MS)).toBe(false);
    s.loadAll();
    expect(s.art()).toBe("ready");
    expect(s.timers.filter((t) => t.ms === OPENING_FALLBACK_MS)).toHaveLength(1);
    expect(runScript(env("/login")).images).toEqual([]);
    expect(runScript(env("/home", { [OPENING_TEST_FLAG]: "1" })).images).toEqual([]);
  });

  it("doesn't wait for slow pictures for long, and draws its own gate if one fails", () => {
    const slow = runScript(env("/home"));
    const wait = slow.timers.find((t) => t.ms === OPENING_ART_WAIT_MS)!;
    expect(wait).toBeDefined();
    wait.fn();
    expect(slow.art()).toBe("ready");
    expect(slow.timers.filter((t) => t.ms === OPENING_FALLBACK_MS)).toHaveLength(1);
    // A late arrival changes nothing; the sequence started once.
    slow.loadAll();
    expect(slow.timers.filter((t) => t.ms === OPENING_FALLBACK_MS)).toHaveLength(1);

    const broken = runScript(env("/home"));
    broken.images[1]!.onerror?.();
    expect(broken.art()).toBe("missing");
    expect(broken.state()).toBe("play");
    broken.images[0]!.onload?.();
    broken.images[2]!.onload?.();
    expect(broken.art()).toBe("missing");
    expect(broken.timers.filter((t) => t.ms === OPENING_FALLBACK_MS)).toHaveLength(1);
  });

  it("Enter finishes opening the door and brightening the light from where they are, so the camera never passes a half-open door", () => {
    const angle = 55;
    const rad = (angle * Math.PI) / 180;
    const door = fakeEl({ transform: `matrix3d(${Math.cos(rad)}, 0, ${-Math.sin(rad)}, 0, 0, 1, 0, 0, ${Math.sin(rad)}, 0, ${Math.cos(rad)}, 0, 0, 0, 0, 1)` });
    const light = fakeEl({ opacity: "0.6" });
    const s = runScript(env("/home"), { door, light });
    s.loadAll();
    s.fire("click", { target: { closest: (sel: string) => (sel === "[data-intro-enter]" ? {} : null) } });
    expect(s.state()).toBe("entering");
    expect(door.style.animation).toBe("none");
    expect(door.animated).toHaveLength(1);
    expect(door.animated[0]!.keyframes).toEqual([{ transform: "rotateY(55.00deg)" }, { transform: "rotateY(80deg)" }]);
    expect(door.animated[0]!.duration).toBeLessThan(400);
    expect(light.animated[0]!.keyframes).toEqual([{ opacity: 0.6 }, { opacity: 1 }]);
    // A door already open is left as it is.
    const open = fakeEl({ transform: `matrix3d(${Math.cos(1.396)}, 0, ${-Math.sin(1.396)}, 0, 0, 1, 0, 0, ${Math.sin(1.396)}, 0, ${Math.cos(1.396)}, 0, 0, 0, 0, 1)` });
    const t = runScript(env("/home"), { door: open, light: fakeEl({ opacity: "1" }) });
    t.loadAll();
    t.fire("click", { target: { closest: (sel: string) => (sel === "[data-intro-enter]" ? {} : null) } });
    expect(open.animated).toHaveLength(0);
  });

  it("coming back from the background mid-opening fades it out instead of resuming; the app starting up doesn't", () => {
    const realNow = Date.now;
    try {
      let now = NOW;
      Date.now = () => now;
      const s = runScript(env("/home"));
      s.loadAll();
      s.setVisibility("hidden");
      now += OPENING_AWAY_MS + 500;
      s.setVisibility("visible");
      expect(s.state()).toBe("leaving");

      // A short glance away (under a second) carries on.
      now = NOW;
      const brief = runScript(env("/home"));
      brief.setVisibility("hidden");
      now += 300;
      brief.setVisibility("visible");
      expect(brief.state()).toBe("play");

      // The iPhone app's web view reports "hidden" while it starts, then "visible": that is the start, not a return.
      now = NOW;
      const native = runScript(env("/", {}, true, true));
      now += 3000;
      native.setVisibility("visible");
      expect(native.state()).toBe("play");
    } finally {
      Date.now = realNow;
    }
  });

  it("Enter Narrow Gate moves into the light, then finishes", () => {
    const s = runScript(env("/home"));
    expect(s.state()).toBe("play");
    s.fire("click", { target: elsewhere });
    expect(s.state()).toBe("play");
    s.fire("click", { target: enter });
    expect(s.state()).toBe("entering");
    // A second press, or Skip, while moving into the light changes nothing.
    s.fire("click", { target: dismiss });
    expect(s.state()).toBe("entering");
    s.fire("animationend", { animationName: "ngo-enter-out" });
    expect(s.state()).toBe("done");
  });

  it("Skip intro fades it out, then finishes", () => {
    const s = runScript(env("/home"));
    s.fire("click", { target: dismiss });
    expect(s.state()).toBe("leaving");
    s.fire("animationend", { animationName: "ngo-leave" });
    expect(s.state()).toBe("done");
  });

  it("Escape leaves too", () => {
    const s = runScript(env("/"));
    s.fire("keydown", { key: "Enter" });
    expect(s.state()).toBe("play");
    s.fire("keydown", { key: "Escape" });
    expect(s.state()).toBe("leaving");
  });

  it("finishes by itself when the exit animation ends, with a timer as the fallback", () => {
    const s = runScript(env("/home"));
    s.fire("animationend", { animationName: "ngo-rise" });
    expect(s.state()).toBe("play");
    s.fire("animationend", { animationName: "ngo-exit" });
    expect(s.state()).toBe("done");

    const t = runScript(env("/home"));
    // (The end's fallback timer starts with the sequence, once the gate's pictures are in.)
    t.loadAll();
    const fallback = t.timers.find((x) => x.ms === OPENING_FALLBACK_MS)!;
    expect(fallback).toBeDefined();
    fallback.fn();
    expect(t.state()).toBe("done");
    // Nothing can bring it back once done.
    t.fire("click", { target: dismiss });
    expect(t.state()).toBe("done");
  });

  it("registers nothing when it doesn't play", () => {
    const s = runScript(env("/login"));
    expect(Object.keys(s.listeners)).toEqual([]);
    expect(s.timers).toEqual([]);
  });
});
