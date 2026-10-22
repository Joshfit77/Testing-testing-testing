import Link from "next/link";
import { PlanLocked } from "@/components/common/plan-locked";
import { hasFeature, type Feature } from "@/lib/domain/plans";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";

/**
 * Signed-in user for a Food sub-screen, and whether their plan includes it. The food diary, search, barcode
 * scanning, macros, saved meals and insights are free (`nutrition_tracking`); recipes, the meal planner and the
 * grocery list are Plus (`meal_planning`).
 */
export async function nutritionPageUser(feature: Feature = "nutrition_tracking") {
  const { user, profile } = await requireOnboardedUser();
  const plan = await getUserPlan(user.id);
  return { user, profile, allowed: hasFeature(plan, feature) };
}

/** The honest locked state for a Plus food tool. */
export function NutritionLocked({ title, description }: { title: string; description: string }) {
  return <PlanLocked back={{ href: "/nutrition", label: "Food" }} eyebrow="Food" title={title} plan="Plus" description={description} />;
}

/** Links between the Food tools, shown on each tool screen. */
export const FOOD_TOOLS = [
  { href: "/nutrition/recipes", label: "Recipes" },
  { href: "/nutrition/saved-meals", label: "Saved meals" },
  { href: "/nutrition/planner", label: "Meal planner" },
  { href: "/nutrition/grocery", label: "Grocery list" },
  { href: "/nutrition/insights", label: "Insights" },
] as const;

export function FoodToolsNav({ current }: { current: string }) {
  return (
    <nav aria-label="Food tools" className="-mx-4 overflow-x-auto px-4 pb-1">
      <ul className="flex gap-2">
        {FOOD_TOOLS.map((t) => (
          <li key={t.href} className="shrink-0">
            <Link
              href={t.href}
              aria-current={t.href === current ? "page" : undefined}
              className={
                t.href === current
                  ? "inline-flex min-h-11 items-center rounded-full border border-gold bg-gold/10 px-4 text-sm font-semibold text-gold-highlight"
                  : "inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm text-muted-foreground hover:border-gold-muted hover:text-foreground"
              }
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
