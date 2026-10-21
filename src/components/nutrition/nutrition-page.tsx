import Link from "next/link";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { Button } from "@/components/ui/button";
import { hasFeature } from "@/lib/domain/plans";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";

/** Signed-in user for a Food sub-screen, and whether they have nutrition tracking (Plus / Pro). */
export async function nutritionPageUser() {
  const { user, profile } = await requireOnboardedUser();
  const plan = await getUserPlan(user.id);
  return { user, profile, allowed: hasFeature(plan, "nutrition_tracking") };
}

/** The honest locked state for free accounts. */
export function NutritionLocked({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <BackLink href="/nutrition">Food</BackLink>
      <PageHeader eyebrow="Food" title={title} />
      <EmptyState
        icon={Lock}
        title="Included with Plus and Pro"
        description={description}
        action={
          <Button asChild>
            <Link href="/profile/billing">See plans</Link>
          </Button>
        }
      />
    </div>
  );
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
