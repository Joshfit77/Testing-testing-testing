import { readFileSync } from "node:fs";
import { decideOpening, NATIVE_APP_UA_TOKEN, OPENING_FALLBACK_MS, OPENING_IMAGES, OPENING_SCRIPT, OPENING_TEST_FLAG, type OpeningEnv } from "@/lib/opening";

type Listener = (e: { key?: string; animationName?: string; target?: unknown }) => void;

/** Runs the real inline head script against a fake page and returns its state machine. */
function runScript(env: OpeningEnv) {
  const keys = Object.keys(env.storage);
  const listeners: Record<string, Listener[]> = {};
  const timers: { fn: () => void; ms: number }[] = [];
  const documentElement = { dataset: {} as Record<string, string> };
  const preloaded: { rel: string; as: string; href: string }[] = [];
  const document = {
    documentElement,
    visibilityState: env.hidden ? "hidden" : "visible",
    addEventListener: (type: string, fn: Listener) => (listeners[type] ??= []).push(fn),
    createElement: () => ({ rel: "", as: "", href: "" }),
    head: { appendChild: (el: { rel: string; as: string; href: string }) => preloaded.push(el) },
  };
  const window = {
    localStorage: { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => env.storage[k] ?? null },
  };
  const realNow = Date.now;
  Date.now = () => env.now;
  try {
    const navigator = { userAgent: env.native ? `Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 ${NATIVE_APP_UA_TOKEN}` : "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Safari/604.1" };
    new Function("location", "document", "window", "setTimeout", "navigator", OPENING_SCRIPT)({ pathname: env.path }, document, window, (fn: () => void, ms: number) => timers.push({ fn, ms }), navigator);
  } finally {
    Date.now = realNow;
  }
  const fire = (type: string, e: Parameters<Listener>[0]) => listeners[type]?.forEach((fn) => fn(e));
  return { state: () => documentElement.dataset.intro, fire, timers, listeners, preloaded };
}

const NOW = Date.UTC(2026, 9, 24, 12);
const env = (path: string, storage: Record<string, string> = {}, hidden = false, native = false): OpeningEnv => ({ path, storage, hidden, native, now: NOW });
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
  ];
  it.each(cases)("%s", (_name, e, expected) => {
    expect(decideOpening(e)).toBe(expected);
    // The shipped inline script agrees with the documented rule.
    expect(runScript(e).state()).toBe(expected);
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
    new Function("location", "document", "window", "setTimeout", "navigator", OPENING_SCRIPT)({ pathname: "/home" }, document, window, () => 0, { userAgent: "" });
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

  it("preloads the gate's pictures only when it is going to play", () => {
    expect(runScript(env("/home")).preloaded.map((l) => [l.rel, l.as, l.href])).toEqual(OPENING_IMAGES.map((src) => ["preload", "image", src]));
    expect(runScript(env("/login")).preloaded).toEqual([]);
    expect(runScript(env("/home", { [OPENING_TEST_FLAG]: "1" })).preloaded).toEqual([]);
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
