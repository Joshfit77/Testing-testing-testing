import type { Plan } from "./types";

export const FEATURES = [
  "workout_logging",
  "starter_programs",
  "basic_progress",
  "full_program_library",
  "advanced_analytics",
  "nutrition_tracking",
  "ai_coach",
  "ai_plan_generation",
  "advanced_recommendations",
] as const;
export type Feature = (typeof FEATURES)[number];

export interface PlanConfig {
  id: Plan;
  name: string;
  /** Display price in US cents per month. Billing uses the configured Stripe price. */
  priceCents: number;
  /** Optional yearly option (US cents per year) that grants this plan. */
  yearlyPriceCents?: number;
  tagline: string;
  features: Feature[];
  /** AI coach messages per calendar month. */
  aiMonthlyLimit: number;
  /** AI plan generations per calendar month. */
  aiPlanMonthlyLimit: number;
  highlights: string[];
}

function envInt(name: string, fallback: number): number {
  const raw = typeof process !== "undefined" ? process.env[name] : undefined;
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Plan definitions. Prices and AI limits are initial defaults and can be overridden
 * with environment variables without code changes.
 */
export function getPlans(): Record<Plan, PlanConfig> {
  return {
    free: {
      id: "free",
      name: "Free",
      priceCents: 0,
      tagline: "Start training today.",
      features: ["workout_logging", "starter_programs", "basic_progress"],
      aiMonthlyLimit: envInt("PLAN_FREE_AI_MONTHLY_LIMIT", 0),
      aiPlanMonthlyLimit: 0,
      highlights: ["Workout logging & history", "Starter programs", "Basic progress tracking", "Optional faith & discipline section"],
    },
    plus: {
      id: "plus",
      name: "Plus",
      priceCents: envInt("PLAN_PLUS_PRICE_CENTS", 999),
      tagline: "The complete training toolkit.",
      features: [
        "workout_logging",
        "starter_programs",
        "basic_progress",
        "full_program_library",
        "advanced_analytics",
        "nutrition_tracking",
        "ai_coach",
      ],
      aiMonthlyLimit: envInt("PLAN_PLUS_AI_MONTHLY_LIMIT", 60),
      aiPlanMonthlyLimit: 0,
      highlights: ["Full program library", "Advanced analytics", "Food tracking", "AI coach (limited)"],
    },
    pro: {
      id: "pro",
      name: "Pro",
      priceCents: envInt("PLAN_PRO_PRICE_CENTS", 3000),
      yearlyPriceCents: envInt("PLAN_PRO_YEARLY_PRICE_CENTS", 20000),
      tagline: "Personal coaching, powered by AI.",
      features: [...FEATURES],
      aiMonthlyLimit: envInt("PLAN_PRO_AI_MONTHLY_LIMIT", 400),
      aiPlanMonthlyLimit: envInt("PLAN_PRO_AI_PLAN_MONTHLY_LIMIT", 20),
      highlights: [
        "Everything in Plus",
        "Expanded AI coaching",
        "Personalized workout generation",
        "Advanced training recommendations",
      ],
    },
  };
}

export const PLAN_ORDER: Plan[] = ["free", "plus", "pro"];

export function planRank(plan: Plan): number {
  return PLAN_ORDER.indexOf(plan);
}

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return getPlans()[plan].features.includes(feature);
}

/** Can a user on `plan` access a program published at `tier`? */
export function canAccessTier(plan: Plan, tier: Plan): boolean {
  return planRank(plan) >= planRank(tier);
}

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

/**
 * Decide the effective plan for a subscription. Access continues during `past_due`
 * (Stripe is retrying payment) and until the period end after cancellation.
 */
export function effectivePlanFromSubscription(
  sub: { plan: Exclude<Plan, "free">; status: SubscriptionStatus; current_period_end: string | null } | null,
  now: Date = new Date(),
): Plan {
  if (!sub) return "free";
  const periodActive = !sub.current_period_end || new Date(sub.current_period_end).getTime() > now.getTime();
  switch (sub.status) {
    case "active":
    case "trialing":
    case "past_due":
      return periodActive ? sub.plan : "free";
    case "canceled":
      return sub.current_period_end && periodActive ? sub.plan : "free";
    default:
      return "free";
  }
}

export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

/** Percentage saved by paying yearly instead of 12 monthly payments (rounded down). */
export function yearlySavingsPercent(monthlyCents: number, yearlyCents: number): number {
  if (monthlyCents <= 0 || yearlyCents <= 0) return 0;
  return Math.max(0, Math.floor((1 - yearlyCents / (monthlyCents * 12)) * 100));
}

export type BillingInterval = "month" | "year";

/** Best effective plan across all of a user's subscriptions (e.g. an old canceled one plus a new active one). */
export function entitlementFromSubscriptions(
  subs: { plan: Exclude<Plan, "free">; status: SubscriptionStatus; current_period_end: string | null }[],
  now: Date = new Date(),
): { plan: Plan; validUntil: string | null } {
  let best: Plan = "free";
  let validUntil: string | null = null;
  for (const s of subs) {
    const p = effectivePlanFromSubscription(s, now);
    if (planRank(p) > planRank(best)) {
      best = p;
      validUntil = s.current_period_end;
    }
  }
  return { plan: best, validUntil };
}
