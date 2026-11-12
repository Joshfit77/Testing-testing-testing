import Link from "next/link";
import { PlanLocked } from "@/components/common/plan-locked";
import { ProTag } from "@/components/nutrition/pro-tag";
import { hasFeature, type Feature } from "@/lib/domain/plans";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";

/**
 * Signed-in user for a Food sub-screen, and whether their plan includes it. The food diary, search, barcode
 * scanning, macros, saved meals and insights are free (`nutrition_tracking`); recipes, the meal planner and the
 * grocery list are Pro (`meal_planning`).
 */
export async function nutritionPageUser(feature: Feature = "nutrition_tracking") {
  const { user, profile } = await requireOnboardedUser();
  const plan = await getUserPlan(user.id);
  return { user, profile, allowed: hasFeature(plan, feature), planningIncluded: hasFeature(plan, "meal_planning") };
}

/** The honest locked state for a Pro food tool. */
export function NutritionLocked({ title, description }: { title: string; description: string }) {
  return <PlanLocked back={{ href: "/nutrition", label: "Food" }} eyebrow="Food" title={title} description={description} />;
}

/** Links between the Food tools, shown on each tool screen. */
export const FOOD_TOOLS = [
  { href: "/nutrition/recipes", label: "Recipes", pro: true },
  { href: "/nutrition/saved-meals", label: "Saved meals", pro: false },
  { href: "/nutrition/planner", label: "Meal planner", pro: true },
  { href: "/nutrition/grocery", label: "Grocery list", pro: true },
  { href: "/nutrition/insights", label: "Insights", pro: false },
] as const;

/** `planningIncluded` false (a Free member) tags the Pro tools so the lock isn't a surprise. */
export function FoodToolsNav({ current, planningIncluded = true }: { current: string; planningIncluded?: boolean }) {
  return (
    <nav aria-label="Food tools" className="pb-1">
      <ul className="flex flex-wrap gap-2">
        {FOOD_TOOLS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.href === current ? "page" : undefined}
              className={
                t.href === current
                  ? "inline-flex min-h-11 items-center gap-2 rounded-full border border-gold bg-gold/10 px-4 text-sm font-semibold text-gold-highlight"
                  : "inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm text-muted-foreground hover:border-gold-muted hover:text-foreground"
              }
            >
              {t.label}
              {t.pro && !planningIncluded && <ProTag />}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
