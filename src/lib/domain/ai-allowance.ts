/**
 * The member-facing rules of the Pro AI allowance (pure, unit-tested), in one place so the usage screen, the coach's
 * notices and the server agree. Enforcement is in the database (reserve_ai_usage, migration 068); this module only
 * words it. Nothing here exposes model prices or margins.
 *
 * - One monthly pool of AI requests (150 on Pro) for everything the member starts: coach messages, program
 *   generation, meal plans, food photos and labels, food explanations and Bible study questions.
 * - Up to 10 of them may use the advanced model: complex coaching and program generation. The last few are kept for
 *   program generation (PLAN_RESERVE in routing.ts).
 * - The automatic weekly report is included and doesn't use up requests.
 * - The allowance renews on the 1st of each month (UTC), for monthly and yearly members alike: a yearly membership
 *   gets a monthly allowance, not the year's at once.
 */

export type DowngradeReason = "advanced_used" | "member_budget" | "global_budget" | "chat_share_used";

/** The first day of next month (UTC), as the member reads it ("December 1"). */
export function allowanceRenewsOn(now: Date): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

export function allowanceRenewsAt(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** One line added under an answer that called for the advanced model but ran on the standard one. */
export function downgradeNotice(reason: DowngradeReason, now: Date): string {
  const renews = allowanceRenewsOn(now);
  switch (reason) {
    case "advanced_used":
      return `Answered with the standard model: this month's advanced requests are used up. They renew on ${renews}.`;
    case "chat_share_used":
      return `Answered with the standard model: your remaining advanced requests are kept for program generation. They renew on ${renews}.`;
    case "member_budget":
      return `Answered with the standard model, so the rest of this month's requests stay available to you. Advanced requests renew on ${renews}.`;
    case "global_budget":
      return "Answered with the standard model: advanced AI capacity is limited for the rest of this month. This doesn't use up your allowance any differently.";
  }
}

/** What counts against each allowance, for the usage screen. */
export const ALLOWANCE_RULES = {
  requests: [
    "Each message you send the AI Coach",
    "Generating a training program",
    "An AI meal plan",
    "Analysing a meal photo or a nutrition label",
    "An AI explanation of a food",
    "Each Bible study question",
  ],
  advanced: [
    "Generating a training program (always advanced)",
    "Complex coaching: designing or restructuring a program, multi-week training analysis, plateaus, and questions about pain, injury or a medical condition",
  ],
  free: ["Your weekly progress report", "Looking at past conversations, memories and reports", "Every feature that doesn't use AI"],
} as const;
