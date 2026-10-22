import type { Plan } from "./types";

/**
 * What each plan unlocks. The Faith section is free for everyone and is never gated, so it has no feature here.
 *
 *   Free  — food & calorie logging (search, barcode scanning, macros, saved meals, weekly insights), basic workout
 *           logging, starter programs, basic progress and run tracking, and the first three Fitness and Food ranks.
 *   Plus  — everything in Free, plus the full program library, the custom program builder, unlimited workout
 *           templates, recipes / meal planner / grocery list, advanced progress and strength trends, progress-photo
 *           comparisons, all Fitness and Food ranks and rescheduling on the training calendar. No AI.
 *   Pro   — everything in Plus, plus the AI coach (a monthly message allowance) and AI plan generation.
 */
export const FEATURES = [
  // Free
  "workout_logging",
  "starter_programs",
  "basic_progress",
  "nutrition_tracking",
  // Plus
  "full_program_library",
  "custom_program_builder",
  "unlimited_templates",
  "meal_planning",
  "advanced_analytics",
  "advanced_calendar",
  "full_rank_badges",
  // Pro
  "ai_coach",
  "ai_plan_generation",
  "advanced_recommendations",
] as const;
export type Feature = (typeof FEATURES)[number];

const FREE_FEATURES: Feature[] = ["workout_logging", "starter_programs", "basic_progress", "nutrition_tracking"];
const PLUS_FEATURES: Feature[] = [
  ...FREE_FEATURES,
  "full_program_library",
  "custom_program_builder",
  "unlimited_templates",
  "meal_planning",
  "advanced_analytics",
  "advanced_calendar",
  "full_rank_badges",
];

export interface PlanConfig {
  id: Plan;
  name: string;
  /** Display price in US cents per month. Billing uses the configured Stripe price. */
  priceCents: number;
  /** Optional yearly option (US cents per year) that grants this plan. Offered only when set. */
  yearlyPriceCents?: number;
  tagline: string;
  features: Feature[];
  /** AI coach requests per calendar month (chat messages and plan generations together). */
  aiMonthlyLimit: number;
  /** AI plan generations per calendar month (part of `aiMonthlyLimit`). */
  aiPlanMonthlyLimit: number;
  /**
   * Requests per calendar month that may use the larger model (plan generation and complex coaching tasks).
   * Everything else runs on the fast model, so this caps the larger model's share of `aiMonthlyLimit`.
   */
  aiSmartMonthlyLimit: number;
  /** Saved workout templates allowed, or null for unlimited. */
  templateLimit: number | null;
  /** Highest Fitness and Food rank level shown as earnable (Faith ranks are always all free). */
  rankLevelLimit: number;
  highlights: string[];
}

function envInt(name: string, fallback: number): number {
  const raw = typeof process !== "undefined" ? process.env[name] : undefined;
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Plan definitions. Prices and limits are defaults that can be overridden with environment variables without a
 * code change. Display prices must match the Stripe (and, later, App Store / Play) prices actually charged.
 */
export function getPlans(): Record<Plan, PlanConfig> {
  const proAi = envInt("PLAN_PRO_AI_MONTHLY_LIMIT", 150);
  const proYearly = envInt("PLAN_PRO_YEARLY_PRICE_CENTS", 0);
  return {
    free: {
      id: "free",
      name: "Free",
      priceCents: 0,
      tagline: "Train, eat well and grow in faith.",
      features: FREE_FEATURES,
      aiMonthlyLimit: 0,
      aiPlanMonthlyLimit: 0,
      aiSmartMonthlyLimit: 0,
      templateLimit: envInt("PLAN_FREE_TEMPLATE_LIMIT", 3),
      rankLevelLimit: 3,
      highlights: [
        "Food & calorie logging with barcode scanning",
        "Macro tracking",
        "Workout logging & starter programs",
        "Basic progress & run tracking",
        "The complete Faith section, always free",
      ],
    },
    plus: {
      id: "plus",
      name: "Plus",
      priceCents: envInt("PLAN_PLUS_PRICE_CENTS", 1199),
      tagline: "The complete fitness and nutrition toolkit.",
      features: PLUS_FEATURES,
      aiMonthlyLimit: 0,
      aiPlanMonthlyLimit: 0,
      aiSmartMonthlyLimit: 0,
      templateLimit: null,
      rankLevelLimit: 9,
      highlights: [
        "Everything in Free",
        "Full program library & custom program builder",
        "Unlimited workout templates",
        "Meal planner, recipes & grocery lists",
        "Advanced progress & strength trends",
        "Progress-photo comparisons",
        "All Fitness & Food badges",
        "Reschedule sessions on your training calendar",
      ],
    },
    pro: {
      id: "pro",
      name: "Pro",
      priceCents: envInt("PLAN_PRO_PRICE_CENTS", 2499),
      ...(proYearly > 0 ? { yearlyPriceCents: proYearly } : {}),
      tagline: "Personal coaching, powered by AI.",
      features: [...FEATURES],
      aiMonthlyLimit: proAi,
      aiPlanMonthlyLimit: envInt("PLAN_PRO_AI_PLAN_MONTHLY_LIMIT", 15),
      aiSmartMonthlyLimit: Math.min(proAi, envInt("PLAN_PRO_AI_SMART_MONTHLY_LIMIT", Math.round(proAi * 0.1))),
      templateLimit: null,
      rankLevelLimit: 9,
      highlights: [
        "Everything in Plus",
        `AI coach: ${proAi} messages a month`,
        "Personalized AI workout plans, saved only when you approve",
        "Exercise swaps and nutrition-target suggestions you approve",
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
