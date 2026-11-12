import { getPlans, yearlySavingsPercent, type Feature } from "./plans";

/**
 * What the membership screen compares. Each Pro row names the feature key the server enforces, so a test can
 * check the screen never promises a Free member something the server refuses, or hides something Free includes.
 */
export interface ComparisonRow {
  label: string;
  /** What Free includes: true, false, or a short limit ("5", "View"). */
  free: boolean | string;
  /** What Pro All Access includes. */
  pro: true | string;
  /** The feature key that gates the Pro part (absent when both plans include it in full). */
  feature?: Feature;
}

export interface ComparisonSection {
  title: string;
  rows: ComparisonRow[];
}

export function membershipComparison(): ComparisonSection[] {
  const pro = getPlans().pro;
  const free = getPlans().free;
  return [
    {
      title: "AI personal coaching",
      rows: [
        { label: "AI fitness coach", free: false, pro: `${pro.aiMonthlyLimit} requests / month`, feature: "ai_coach" },
        { label: "Personalized AI workout plans, saved only when you approve", free: false, pro: `Up to ${pro.aiPlanMonthlyLimit} / month`, feature: "ai_plan_generation" },
        { label: "AI meal plans, food-photo analysis and sleep coaching", free: false, pro: "From your monthly allowance", feature: "ai_coach" },
      ],
    },
    {
      title: "Training",
      rows: [
        { label: "Workout logging, history and personal records", free: true, pro: true },
        { label: "All 157 exercise demonstrations", free: true, pro: true },
        { label: "Starter training programs", free: true, pro: true },
        { label: "Saved workout templates", free: String(free.templateLimit ?? "Unlimited"), pro: "Unlimited", feature: "unlimited_templates" },
        { label: "Complete program library: strength, bodybuilding, powerlifting, athletic, combat sports, calisthenics, running", free: false, pro: true, feature: "full_program_library" },
        { label: "Custom program builder", free: false, pro: true, feature: "custom_program_builder" },
        { label: "Training calendar", free: "View", pro: "Schedule & reschedule", feature: "advanced_calendar" },
        { label: "Strength progression and advanced workout analytics", free: false, pro: true, feature: "advanced_analytics" },
        { label: "Adaptive training adjustments and deload guidance", free: false, pro: true, feature: "advanced_recommendations" },
      ],
    },
    {
      title: "Running & walking",
      rows: [
        { label: "Manual run and walk logging with pace and totals", free: true, pro: true },
        { label: "Live GPS recording with route maps, distance, pace and splits", free: false, pro: true, feature: "live_gps" },
      ],
    },
    {
      title: "Nutrition",
      rows: [
        { label: "Food diary, calories, protein, carbs and fat", free: true, pro: true },
        { label: "Barcode scanning, food search, manual entry and saved meals", free: true, pro: true },
        { label: "Recipes, meal planning and grocery lists", free: false, pro: true, feature: "meal_planning" },
        { label: "Food comparisons and personal food filters", free: false, pro: true, feature: "food_comparisons" },
      ],
    },
    {
      title: "Sleep & recovery",
      rows: [
        { label: "Sleep logging, duration and goal tracking", free: true, pro: true },
        { label: "Sleep quality breakdowns, trends, sleep debt and schedule insights", free: false, pro: true, feature: "sleep_analytics" },
      ],
    },
    {
      title: "Progress",
      rows: [
        { label: "Weight, measurements and progress history", free: true, pro: true },
        { label: "Every Fitness, Food and Faith badge", free: true, pro: true },
        { label: "Progress-photo comparisons and detailed progress analytics", free: false, pro: true, feature: "advanced_analytics" },
        // Body Scan has its own check (canUseBodyScan, and has_plan('pro') with consent in the database).
        { label: "Body Scan with private, consent-based photo storage", free: false, pro: true },
      ],
    },
    {
      title: "Faith & Discipline",
      rows: [{ label: "Scripture, daily devotionals, prayer journal, challenges and the 40-day challenge", free: "Always free", pro: true }],
    },
  ];
}

/** The Pro prices shown before the store or Stripe price has loaded (approved US prices). */
export function proPriceSummary(): { monthCents: number; yearCents: number | null; savingsPercent: number } {
  const pro = getPlans().pro;
  const yearCents = pro.yearlyPriceCents ?? null;
  return { monthCents: pro.priceCents, yearCents, savingsPercent: yearCents ? yearlySavingsPercent(pro.priceCents, yearCents) : 0 };
}
