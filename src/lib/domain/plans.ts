import type { Plan } from "./types";

/**
 * What each plan unlocks. The Faith & Discipline section is free for everyone and is never gated, so it has no
 * feature here. Owner decision of 2026-10-26: new customers choose between two memberships only.
 *
 *   Free            — workout logging, starter programs, all exercise demonstrations, up to five saved workouts,
 *                     basic history and calendar viewing; food diary, calories and macros, barcode scanning, food
 *                     search, manual entry, saved meals and basic insights; manual run and walk logging; basic sleep
 *                     logging and goals; weight and basic progress; every Fitness, Food and Faith badge.
 *   Pro All Access  — everything in Free plus every premium feature: the full program library and custom builder,
 *                     unlimited templates, scheduling, live GPS run and walk recording with route maps and splits,
 *                     recipes, meal planning and grocery lists, food comparisons and filters, advanced sleep and
 *                     recovery analytics, Body Scan, progress-photo comparisons, advanced analytics and the AI coach
 *                     (a monthly allowance). Monthly ($19.99) and yearly ($149.99) unlock exactly the same features.
 *
 *   Plus (legacy)   — no longer sold. Kept only so that members who subscribed to Plus before the change keep exactly
 *                     the access they paid for (including live GPS, which every plan had then) until their
 *                     subscription ends or the owner changes its terms with notice. See docs/MEMBERSHIPS.md.
 */
export const FEATURES = [
  // Free
  "workout_logging",
  "starter_programs",
  "basic_progress",
  "nutrition_tracking",
  // Pro (and legacy Plus subscriptions)
  "full_program_library",
  "custom_program_builder",
  "unlimited_templates",
  "meal_planning",
  "advanced_analytics",
  "advanced_calendar",
  "food_comparisons",
  // Sleep & Recovery analytics (nightly score breakdown, comparisons, sleep debt, windows, energy estimate).
  "sleep_analytics",
  // Live GPS run and walk recording, route maps and splits. Manual run and walk logging stays free.
  "live_gps",
  // Pro only
  "ai_coach",
  "ai_plan_generation",
  "advanced_recommendations",
  "food_goal_analysis",
  // AI sleep coaching and sleep-and-training insights.
  "sleep_ai_coaching",
] as const;
export type Feature = (typeof FEATURES)[number];

const FREE_FEATURES: Feature[] = ["workout_logging", "starter_programs", "basic_progress", "nutrition_tracking"];
/** What a legacy Plus subscription keeps: the paid toolkit it had, without AI (its AI allowance comes from legacy terms). */
const LEGACY_PLUS_FEATURES: Feature[] = [
  ...FREE_FEATURES,
  "full_program_library",
  "custom_program_builder",
  "unlimited_templates",
  "meal_planning",
  "advanced_analytics",
  "advanced_calendar",
  "food_comparisons",
  "sleep_analytics",
  "live_gps",
];

export interface PlanConfig {
  id: Plan;
  name: string;
  /** Display price in US cents per month. Billing uses the configured Stripe price. */
  priceCents: number;
  /** Yearly option (US cents per year) granting the same plan. Web checkout also needs the plan's yearly Stripe price. */
  yearlyPriceCents?: number;
  tagline: string;
  /** Offered to new customers. Legacy plans are kept only for existing subscriptions. */
  purchasable: boolean;
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

/**
 * Approved Pro All Access prices (US cents), owner decision of 2026-10-26. These are the prices shown when the
 * store or Stripe price can't be read; the in-app paywall always shows the store's own localized price, and web
 * checkout shows the amount of the configured Stripe price (see src/server/services/billing.ts).
 */
export const APPROVED_PRO_PRICE_CENTS = { month: 1999, year: 14999 } as const;

/** Paid plans offered to new customers. */
export const PURCHASABLE_PLANS = ["pro"] as const;
/** Plans shown to new customers, in order. */
export const PUBLIC_PLAN_ORDER: Plan[] = ["free", "pro"];

/**
 * Plan definitions. Prices and limits are defaults that can be overridden with environment variables without a
 * code change. Display prices must match the Stripe (and, later, App Store / Play) prices actually charged.
 */
export function getPlans(): Record<Plan, PlanConfig> {
  const proAi = envInt("PLAN_PRO_AI_MONTHLY_LIMIT", 150);
  const proPlans = envInt("PLAN_PRO_AI_PLAN_MONTHLY_LIMIT", 15);
  const proYearly = envInt("PLAN_PRO_YEARLY_PRICE_CENTS", APPROVED_PRO_PRICE_CENTS.year);
  return {
    free: {
      id: "free",
      name: "Free",
      priceCents: 0,
      tagline: "Build your foundation.",
      purchasable: true,
      features: FREE_FEATURES,
      aiMonthlyLimit: 0,
      aiPlanMonthlyLimit: 0,
      aiSmartMonthlyLimit: 0,
      templateLimit: envInt("PLAN_FREE_TEMPLATE_LIMIT", 5),
      highlights: [
        "Workout logging, starter programs & 5 saved workouts",
        "All 157 exercise demonstrations",
        "Food diary, calories & macros, barcode scanning and food search",
        "Manual run & walk logging",
        "Basic sleep logging, weight and progress history",
        "Every Fitness, Food & Faith badge",
        "The complete Faith & Discipline section, always free",
      ],
    },
    plus: {
      id: "plus",
      name: "Plus",
      // What legacy Plus subscribers were charged; shown only to them. Billing uses their existing Stripe or store price.
      priceCents: envInt("PLAN_PLUS_PRICE_CENTS", 1199),
      tagline: "Your earlier membership, kept as you subscribed to it.",
      purchasable: false,
      features: LEGACY_PLUS_FEATURES,
      aiMonthlyLimit: 0,
      aiPlanMonthlyLimit: 0,
      aiSmartMonthlyLimit: 0,
      templateLimit: null,
      highlights: [
        "Everything in Free",
        "Full program library & custom program builder",
        "Unlimited workout templates and calendar scheduling",
        "Live GPS runs & walks, meal planning, food comparisons",
        "Advanced progress, strength and sleep analytics",
      ],
    },
    pro: {
      id: "pro",
      name: "Pro All Access",
      priceCents: envInt("PLAN_PRO_PRICE_CENTS", APPROVED_PRO_PRICE_CENTS.month),
      ...(proYearly > 0 ? { yearlyPriceCents: proYearly } : {}),
      tagline: "One membership. Every premium feature.",
      purchasable: true,
      features: [...FEATURES],
      aiMonthlyLimit: proAi,
      aiPlanMonthlyLimit: Math.min(proAi, proPlans),
      aiSmartMonthlyLimit: Math.min(proAi, envInt("PLAN_PRO_AI_SMART_MONTHLY_LIMIT", Math.round(proAi * 0.1))),
      templateLimit: null,
      highlights: [
        "Everything in Free",
        `AI personal coaching: ${proAi} AI requests a month`,
        "The complete workout library & custom program builder",
        "Live GPS runs & walks with route maps and splits",
        "Recipes, meal planning, grocery lists & food comparisons",
        "Advanced sleep & recovery insights",
        "Body Scan, progress-photo comparisons & advanced analytics",
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
  sub: { plan: Exclude<Plan, "free">; status: SubscriptionStatus; current_period_end: string | null; access_revoked_at?: string | null } | null,
  now: Date = new Date(),
): Plan {
  if (!sub) return "free";
  // The payment for the current period was fully refunded or disputed: that period's access ends (see billing.ts).
  if (sub.access_revoked_at) return "free";
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
export function entitlementFromSubscriptions<
  T extends { plan: Exclude<Plan, "free">; status: SubscriptionStatus; current_period_end: string | null; access_revoked_at?: string | null },
>(
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
  sub: { plan: Exclude<Plan, "free">; status: SubscriptionStatus; current_period_end: string | null; access_revoked_at?: string | null },
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
