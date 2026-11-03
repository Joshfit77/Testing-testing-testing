/**
 * The presenter's guided path through the demo (demo deployments only, shown in the demo bar).
 *
 * Twenty stops in a fixed order. Each one opens a real screen of the app with the sample account's data. The label
 * says honestly what the audience is looking at:
 *   - "live": the real feature, working; anything saved goes into the demo's own database;
 *   - "sample": the real screen, showing made-up history from the demo seed;
 *   - "simulated": the AI's reply comes from a fixed script, not a model (each reply says so on screen);
 *   - "preview": needs a phone (GPS, camera, Apple Health, notification delivery), so the demo walks through the
 *     screens without the hardware.
 *
 * Nothing here unlocks anything: the steps are links. The Free/Pro switch is the demo bar's own, server-checked one.
 */

export type StepLabel = "live" | "sample" | "simulated" | "preview";

export interface PresenterStep {
  n: number;
  title: string;
  href: string;
  /** The pages that belong to this stop (for following the presenter when they use the app's own navigation). */
  match: RegExp;
  label: StepLabel;
  /** One line for the presenter: what to show here. */
  show: string;
}

export const STEP_LABEL_TEXT: Record<StepLabel, string> = {
  live: "Live",
  sample: "Sample data",
  simulated: "Simulated AI",
  preview: "Preview",
};

export const PRESENTER_STEPS: readonly PresenterStep[] = [
  { n: 1, title: "Opening gate", href: "/home", match: /^\/home$/, label: "live", show: "The opening plays once; Skip intro is top right." },
  { n: 2, title: "Home", href: "/home", match: /^\/home$/, label: "sample", show: "Today's workout, nutrition, Faith and recovery at a glance." },
  { n: 3, title: "Programs", href: "/train/programs", match: /^\/(train\/(programs|build)(\/.*)?|plan|calendar)$/, label: "live", show: "The program library and the active plan." },
  { n: 4, title: "Live workout", href: "/train", match: /^\/train(\/(workout|review|templates)(\/.*)?|\/history(\/.*)?)?$/, label: "live", show: "Start today's workout, log a set, Skip the rest timer." },
  { n: 5, title: "Exercise demos", href: "/train/exercises/back-squat", match: /^\/train\/(exercises|3d)(\/|$)/, label: "live", show: "Animated exercise demo; the 3D viewer is experimental." },
  { n: 6, title: "AI coach", href: "/coach", match: /^\/coach(\/|$)/, label: "simulated", show: "Ask a question: the reply is scripted and says so." },
  { n: 7, title: "Nutrition", href: "/nutrition", match: /^\/nutrition(\/(diets|planner|grocery|insights|recipes|saved-meals|supplements|compare)(\/.*)?)?$/, label: "sample", show: "Today's food diary against the member's targets." },
  { n: 8, title: "Food photo", href: "/nutrition/photo", match: /^\/nutrition\/photo(\/|$)/, label: "simulated", show: "Any photo returns fixed sample items to review and edit." },
  { n: 9, title: "Ingredients", href: "/nutrition/label", match: /^\/nutrition\/(label|scanner|product)(\/|$)/, label: "live", show: "Check a label: additives, sugars, sodium and allergens explained." },
  { n: 10, title: "GPS", href: "/run", match: /^\/run(\/|$)/, label: "preview", show: "Runs on sample routes; live recording needs the phone app outdoors." },
  { n: 11, title: "Progress", href: "/progress", match: /^\/progress(\/(overview|badges|body-map|body-scan)(\/.*)?)?$/, label: "sample", show: "Strength records, bodyweight trend, badges; body scan is a walk-through." },
  { n: 12, title: "Health & recovery", href: "/progress/sleep", match: /^\/(progress\/sleep|train\/recovery)(\/|$)/, label: "sample", show: "Sleep and recovery from sample nights (pretend Apple Health imports)." },
  { n: 13, title: "Faith dashboard", href: "/faith", match: /^\/faith$/, label: "live", show: "Free for every member: today's reading, prayer and practices." },
  { n: 14, title: "Bible", href: "/faith/bible/matthew/7", match: /^\/faith\/bible(\/|$)/, label: "live", show: "The BSB with the words of Jesus in red, highlights and notes." },
  { n: 15, title: "Journeys", href: "/faith/journey", match: /^\/faith\/journey(\/|$)/, label: "live", show: "A 90-day Gospels journey on day 21: read and pray each day." },
  { n: 16, title: "Prayer journal", href: "/faith/journal", match: /^\/faith\/(journal|memory)(\/|$)/, label: "live", show: "Requests, an answered prayer, and memory verses." },
  { n: 17, title: "Faith challenges", href: "/faith#challenge", match: /^\/faith(\/(practices|studies)(\/.*)?)?$/, label: "live", show: "The 40-day challenge and daily disciplines." },
  { n: 18, title: "Notifications", href: "/profile/notifications", match: /^\/(profile\/notifications|faith\/reminders)(\/|$)/, label: "preview", show: "Reminder settings and the next-24-hours preview; delivery needs the phone app." },
  { n: 19, title: "Free vs Pro", href: "/profile/billing", match: /^\/profile\/billing(\/|$)/, label: "live", show: "Annual is the main offer. Switch View as Free / Pro in this bar: nothing is charged." },
  { n: 20, title: "Close on Home", href: "/home", match: /^\/home$/, label: "sample", show: "Back to Home to close." },
];

export const STEP_COUNT = PRESENTER_STEPS.length;

/** Session storage keys (the demo's browser tab only; nothing is sent anywhere). */
export const PRESENTER_STEP_KEY = "ngf.demo.step";
export const PRESENTER_VIEW_KEY = "ngf.demo.presenter";
export const DEMO_INTRO_SHOWN_KEY = "ngf.demo.introShown";

export function stepByNumber(n: number): PresenterStep | undefined {
  return PRESENTER_STEPS.find((s) => s.n === n);
}

/**
 * Which stop the presenter is on: the remembered one while its page is showing; otherwise the first stop the page
 * belongs to (they used the app's own navigation); otherwise none (they've gone off the path, and the panel offers
 * the way back to the remembered stop).
 */
export function currentStep(path: string, remembered: number | null): { step: PresenterStep | null; offPath: boolean } {
  const kept = remembered ? stepByNumber(remembered) : undefined;
  if (kept && kept.match.test(path)) return { step: kept, offPath: false };
  const found = PRESENTER_STEPS.find((s) => s.n !== 1 && s.n !== STEP_COUNT && s.match.test(path));
  if (found) return { step: found, offPath: false };
  return { step: kept ?? null, offPath: true };
}

/**
 * Demo deployments only, inlined in <head> right after the opening script: the opening (the gate) plays once per
 * browser tab, at the start of the presentation, not again on every reload. The presenter can play it again from the
 * panel. Plain ES5; any error leaves the opening's own decision unchanged.
 */
export const DEMO_INTRO_ONCE_SCRIPT = `(function(){try{var d=document.documentElement,s=window.sessionStorage,k=${JSON.stringify(DEMO_INTRO_SHOWN_KEY)};if(d.dataset.intro!=="play")return;if(s.getItem(k)==="1"){d.dataset.intro="off";return}s.setItem(k,"1")}catch(e){}})();`;
