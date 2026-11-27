import { describe, expect, it } from "vitest";
import { FAITH_REMINDER_INFO, FAITH_REMINDER_KINDS, defaultFaithReminder } from "@/lib/faith-reminders";
import { APP_REMINDER_INFO, APP_REMINDER_KINDS, defaultAppReminder } from "@/lib/notifications/catalog";
import { DEFAULT_NOTIFICATION_PREFS, NOTHING_DONE, planNotifications } from "@/lib/notifications/planner";
import { reminderMessage, type JsWeekday } from "@/lib/reminders";

/**
 * What a notification may say on a lock screen (owner's rules, 2026-11-03): nothing the member wrote, no health
 * details or numbers, no guilt about food, weight or missed days, nothing tying a reminder to anyone's salvation or
 * standing before God, and no marketing.
 */
const workoutMessages = (["friendly", "faith"] as const).flatMap((style) => ([0, 1, 2, 3, 4, 5, 6] as JsWeekday[]).map((d) => reminderMessage(style, d, true)));
const ALL = [
  ...Object.values(FAITH_REMINDER_INFO).map((i) => ({ title: i.title, body: i.body })),
  ...Object.values(APP_REMINDER_INFO).map((i) => ({ title: i.title, body: i.body })),
  ...workoutMessages,
];
const text = ALL.map((m) => `${m.title} ${m.body}`);

describe("notification wording", () => {
  it("never mentions calories, weight, amounts or other health details", () => {
    for (const t of text) {
      expect(t, t).not.toMatch(/calor|kcal|\bweigh|\bkg\b|\blbs?\b|\bpounds?\b|\bml\b|\boz\b|\bounces?\b|\bbmi\b|body fat|\bfat\b|macro|protein|carb|\bsugar|heart rate|\bhrv\b|sleep score|\bscore\b/i);
      // Amounts of food, drink, sleep or activity. (Generic encouragement such as "even 20 minutes counts" is fine:
      // it isn't anyone's own data, and the next test shows no text is built from the member's data.)
      expect(t, t).not.toMatch(/\d+\s*(%|percent|steps|hours?|glass(es)?|cups?|litres?|liters?)/i);
    }
  });

  it("carries no guilt or pressure about food, training or missed days", () => {
    for (const t of text) expect(t, t).not.toMatch(/\bmissed\b|\bfail|\bbehind\b|streak|don'?t break|\blazy|\bcheat|\bguilt|\bshame|\bbad\b|\bslip|\bblew\b|\bearn\b|\bdeserve|\bpunish|\bburn off|\bjunk|\boverate|\bwasted\b|\bexcuses?\b/i);
  });

  it("never ties a reminder to salvation or anyone's standing before God", () => {
    for (const t of text) expect(t, t).not.toMatch(/salvation|\bsaved\b|\bsin\b|\bsinful|disappoint|\bfavou?r\b|standing|judg|condemn|unworthy|god is (angry|watching|waiting)|lose your|\bhell\b|repent/i);
  });

  it("contains nothing the member wrote: every title and body is fixed text from the catalogue", () => {
    for (const m of ALL) expect(`${m.title}${m.body}`).not.toMatch(/\$\{|\{\{|undefined|null/);
    const allowed = new Set(ALL.map((m) => `${m.title}\u0000${m.body}`));
    const faith = FAITH_REMINDER_KINDS.map((k) => ({ ...defaultFaithReminder(k), enabled: true }));
    const app = APP_REMINDER_KINDS.map((k) => ({ ...defaultAppReminder(k), enabled: true, style: "faith" as const }));
    const planned = planNotifications({
      faith,
      app,
      prefs: { ...DEFAULT_NOTIFICATION_PREFS, dailyLimit: 20 },
      ctx: {
        today: "2026-11-03",
        timezone: "America/New_York",
        now: new Date("2026-11-03T09:00:00Z"),
        faithEnabled: true,
        journeyActive: true,
        done: { ...NOTHING_DONE },
        training: { hasProgram: true, workoutDates: ["2026-11-03", "2026-11-05"] },
        openPrayerRequests: 3,
      },
      budget: 500,
    });
    expect(planned.length).toBeGreaterThan(40);
    for (const n of planned) expect(allowed.has(`${n.title}\u0000${n.body}`), `${n.kind}: ${n.title} / ${n.body}`).toBe(true);
  });

  it("uses the owner's wording for Bible reading, prayer and the evening reminder", () => {
    expect(FAITH_REMINDER_INFO.reading.body).toBe("Don't forget to spend time with the Lord today. Your Bible reading is ready.");
    expect(FAITH_REMINDER_INFO.prayer.body).toBe("Take a few moments to pray and bring your requests before the Lord.");
    expect(FAITH_REMINDER_INFO.accountability.body).toBe("Before the day ends, remember your Bible reading and prayer.");
  });

  it("there is no marketing or promotional reminder, and nothing is on by default", () => {
    for (const t of text) expect(t, t).not.toMatch(/\boffer|\bsale\b|discount|upgrade|\bpro\b|subscribe|premium|\bdeal\b|limited time|\bfree trial/i);
    expect(FAITH_REMINDER_KINDS.map(defaultFaithReminder).some((r) => r.enabled)).toBe(false);
    expect(APP_REMINDER_KINDS.map(defaultAppReminder).some((r) => r.enabled)).toBe(false);
  });
});
