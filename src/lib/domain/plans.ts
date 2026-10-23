import type { Plan } from "./types";

/**
 * What each plan unlocks. The Faith section is free for everyone and is never gated, so it has no feature here.
 *
 *   Free  — food & calorie logging (search, barcode scanning, macros, saved meals, weekly insights), basic workout
 *           logging, up to five saved workouts, starter programs, basic progress and run tracking, viewing the
 *           training calendar, and every Fitness, Food and Faith rank badge.
 *   Plus  — everything in Free, plus the full program library, the custom program builder, unlimited workout
 *           templates, recipes / meal planner / grocery list, advanced progress and strength trends, progress-photo
 *           comparisons, scheduling/rescheduling on the training calendar, and product comparisons and personal
 *           filters in Narrow Gate Food IQ. No AI.
 *   Pro   — everything in Plus, plus the AI coach (a monthly message allowance), AI plan generation and Food IQ's
 *           "Fits your goals" analysis of each product against the member's own targets.
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
  "food_comparisons",
  // Pro
  "ai_coach",
  "ai_plan_generation",
  "advanced_recommendations",
  "food_goal_analysis",
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
  "food_comparisons",
];

export interface PlanConfig {
  id: Plan;
  name: string;
  /** Display price in US cents per month. Billing uses the configured Stripe price. */
  priceCents: number;
  /**
   * Yearly option (US cents per year) that grants this plan. Set only while yearly billing is switched on
   * (`BILLING_YEARLY_ENABLED=true`); web checkout additionally needs the plan's yearly Stripe price.
   */
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
  highlights: string[];
}

function envInt(name: string, fallback: number): number {
  const raw = typeof process !== "undefined" ? process.env[name] : undefined;
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Approved yearly prices (US cents). Hidden until yearly billing is switched on; env vars can override them. */
export const APPROVED_YEARLY_PRICE_CENTS = { plus: 9999, pro: 24999 } as const;

function yearlyPrice(plan: "plus" | "pro"): { yearlyPriceCents: number } | Record<string, never> {
  const enabled = typeof process !== "undefined" && process.env.BILLING_YEARLY_ENABLED === "true";
  if (!enabled) return {};
  const cents = envInt(`PLAN_${plan.toUpperCase()}_YEARLY_PRICE_CENTS`, APPROVED_YEARLY_PRICE_CENTS[plan]);
  return cents > 0 ? { yearlyPriceCents: cents } : {};
}

/**
 * Plan definitions. Prices and limits are defaults that can be overridden with environment variables without a
 * code change. Display prices must match the Stripe (and, later, App Store / Play) prices actually charged.
 */
export function getPlans(): Record<Plan, PlanConfig> {
  const proAi = envInt("PLAN_PRO_AI_MONTHLY_LIMIT", 150);
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
      templateLimit: envInt("PLAN_FREE_TEMPLATE_LIMIT", 5),
      highlights: [
        "Food & calorie logging with barcode scanning",
        "Macro tracking",
        "Workout logging, starter programs & 5 saved workouts",
        "Basic progress, run tracking & your training calendar",
        "Every Fitness, Food & Faith badge",
        "The complete Faith section, always free",
      ],
    },
    plus: {
      id: "plus",
      name: "Plus",
      priceCents: envInt("PLAN_PLUS_PRICE_CENTS", 1199),
      ...yearlyPrice("plus"),
      tagline: "The complete fitness and nutrition toolkit.",
      features: PLUS_FEATURES,
      aiMonthlyLimit: 0,
      aiPlanMonthlyLimit: 0,
      aiSmartMonthlyLimit: 0,
      templateLimit: null,
      highlights: [
        "Everything in Free",
        "Full program library & custom program builder",
        "Unlimited workout templates",
        "Meal planner, recipes & grocery lists",
        "Advanced progress & strength trends",
        "Progress-photo comparisons",
        "Schedule & reschedule sessions on your training calendar",
      ],
    },
    pro: {
      id: "pro",
      name: "Pro",
      priceCents: envInt("PLAN_PRO_PRICE_CENTS", 2499),
      ...yearlyPrice("pro"),
      tagline: "Personal coaching, powered by AI.",
      features: [...FEATURES],
      aiMonthlyLimit: proAi,
      aiPlanMonthlyLimit: envInt("PLAN_PRO_AI_PLAN_MONTHLY_LIMIT", 15),
      aiSmartMonthlyLimit: Math.min(proAi, envInt("PLAN_PRO_AI_SMART_MONTHLY_LIMIT", Math.round(proAi * 0.1))),
      templateLimit: null,
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
 * Decide the effective plan for a subscription. Access continues during `past_due` (Stripe is retrying payment)
 * and, for a subscription set to cancel at the period end, until then (Stripe keeps it `active` meanwhile). A
 * `canceled` subscription has ended: Stripe uses it for immediate cancellations and after failed renewals, when
 * the period end has already moved on although nothing was paid.
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

/**
 * Best effective plan across all of a user's subscriptions (e.g. an old canceled one plus a new active one, or a
 * web subscription plus an App Store one). `from` is the subscription that grants it.
 */
export function entitlementFromSubscriptions<T extends { plan: Exclude<Plan, "free">; status: SubscriptionStatus; current_period_end: string | null }>(
  subs: T[],
  now: Date = new Date(),
): { plan: Plan; validUntil: string | null; from: T | null } {
  let best: Plan = "free";
  let validUntil: string | null = null;
  let from: T | null = null;
  for (const s of subs) {
    const p = effectivePlanFromSubscription(s, now);
    if (planRank(p) > planRank(best)) {
      best = p;
      validUntil = s.current_period_end;
      from = s;
    }
  }
  return { plan: best, validUntil, from };
}

/**
 * AI allowance a subscription kept from before the October 2026 plan change (`legacy_plan_terms`). Existing Plus
 * subscribers had an AI coach allowance, so it stays with that subscription while it remains active on the same
 * plan; new Plus subscriptions have no AI.
 */
export interface LegacyAiTerms {
  plan: Exclude<Plan, "free">;
  aiMonthlyLimit: number;
  aiPlanMonthlyLimit: number;
  aiSmartMonthlyLimit: number;
}

export interface AiAllowance {
  chatLimit: number;
  planLimit: number;
  smartLimit: number;
  /** True when kept legacy terms raise the allowance above the current plan's. */
  legacy: boolean;
}

/** The monthly AI allowance for a plan, raised by any legacy terms still in force (the caller checks they apply). */
export function aiAllowance(plan: Plan, legacy: LegacyAiTerms[] = []): AiAllowance {
  const c = getPlans()[plan];
  const entitled = hasFeature(plan, "ai_coach");
  const base = {
    chatLimit: entitled ? c.aiMonthlyLimit : 0,
    planLimit: hasFeature(plan, "ai_plan_generation") ? c.aiPlanMonthlyLimit : 0,
    smartLimit: entitled ? c.aiSmartMonthlyLimit : 0,
  };
  const out = { ...base, legacy: false };
  for (const t of legacy) {
    out.chatLimit = Math.max(out.chatLimit, t.aiMonthlyLimit);
    out.planLimit = Math.max(out.planLimit, t.aiPlanMonthlyLimit);
    out.smartLimit = Math.max(out.smartLimit, t.aiSmartMonthlyLimit);
  }
  out.legacy = out.chatLimit > base.chatLimit || out.planLimit > base.planLimit || out.smartLimit > base.smartLimit;
  return out;
}

/** Legacy terms apply while their subscription still gives access on the same plan and they haven't been ended. */
export function legacyTermsApply(
  terms: { plan: Exclude<Plan, "free">; ends_at: string | null },
  sub: { plan: Exclude<Plan, "free">; status: SubscriptionStatus; current_period_end: string | null },
  now: Date = new Date(),
): boolean {
  if (terms.ends_at && new Date(terms.ends_at).getTime() <= now.getTime()) return false;
  return sub.plan === terms.plan && effectivePlanFromSubscription(sub, now) === terms.plan;
}

/** The plan an entitlement row grants now: its plan while `valid_until` hasn't passed, otherwise Free. */
export function planFromEntitlement(row: { plan: string | null; valid_until: string | null } | null, now: Date = new Date()): Plan {
  if (!row?.plan) return "free";
  if (row.valid_until && new Date(row.valid_until).getTime() < now.getTime()) return "free";
  return (PLAN_ORDER as string[]).includes(row.plan) ? (row.plan as Plan) : "free";
}
