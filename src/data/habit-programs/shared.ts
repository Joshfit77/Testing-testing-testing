import type { HabitActivity } from "@/lib/domain/habit-programs";

/** Small builders shared by the habit program content files. */

/** Lesson note required on every nutrition-related program. */
export const PROFESSIONAL_NOTE =
  "A note before you start: this program is general education, not medical or dietetic advice. If you have a medical condition (for example diabetes, kidney disease or high blood pressure), are pregnant or breastfeeding, take medication affected by diet, or have a history of disordered eating, please speak to your doctor or a registered dietitian before changing how you eat.";

export const FOOD_FIRST_NOTE =
  "Food first is the norm. Most people can meet their needs from ordinary meals, and this program does not recommend any supplements. If you are thinking about one, talk it through with a qualified professional.";

export const FAITH_NOTE =
  "Your physical performance and the activities you complete are never a measure of your spiritual standing: you are loved by God by grace, not by streaks, scores or the weight on the bar.";

export const COMPLETION_80 = {
  minShare: 0.8,
  text: "Complete at least 80% of the required daily and weekly activities by the final day. Optional activities never count against you, and a missed day is simply missed: nothing restarts.",
};

export function lesson(): HabitActivity {
  return { key: "lesson", kind: "lesson", title: "Read this week's lesson", detail: "A few minutes, once this week." };
}

export function checkin(questions: string[]): HabitActivity {
  return { key: "checkin", kind: "checkin", title: "Weekly check-in", detail: "Answer in a few words. There are no wrong answers.", questions };
}

export function bibleHref(book: string, chapter: number): string {
  return `/faith/bible/${book}/${chapter}`;
}

/** Seven optional daily readings, one per day of the week (keys read-1 … read-7). */
export function readingWeek(readings: [book: string, chapter: number, title: string][]): HabitActivity[] {
  return readings.map(([book, chapter, title], i) => ({
    key: `read-${i + 1}`,
    kind: "scripture",
    title,
    detail: "Optional. Read slowly; one chapter is plenty.",
    href: bibleHref(book, chapter),
    optional: true,
    onDays: [i + 1],
  }));
}

export function prayer(detail: string): HabitActivity {
  return { key: "prayer", kind: "prayer", title: "Prayer", detail: `Optional. ${detail}`, href: "/faith", optional: true };
}

export function reflection(prompt: string, onDays?: number[]): HabitActivity {
  return {
    key: "reflection",
    kind: "reflection",
    title: "Reflection",
    detail: `Optional, in your private prayer journal. ${prompt}`,
    href: "/faith/journal/new",
    optional: true,
    ...(onDays ? { onDays } : {}),
  };
}
