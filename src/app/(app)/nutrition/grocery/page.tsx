import Link from "next/link";
import { ActionButton } from "@/components/common/action-button";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { AddGroceryItemForm, GenerateGroceryForm, GroceryItems, type GroceryItemView } from "@/components/nutrition/grocery-client";
import { FoodToolsNav, NutritionLocked, nutritionPageUser } from "@/components/nutrition/nutrition-page";
import { isoDateInTz } from "@/lib/domain/dates";
import { formatLongDate } from "@/lib/domain/diary";
import { getServerSupabase } from "@/lib/supabase/server";
import { clearGroceryAction } from "@/server/actions/grocery";
import { logError } from "@/server/log";
import { addDaysIso, loadCurrentPlan } from "@/server/services/meal-plan";

export const metadata = { title: "Grocery list" };

const fmtQty = (q: number) => (Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100));

export default async function GroceryPage() {
  const { user, profile, allowed } = await nutritionPageUser();
  if (!allowed) return <NutritionLocked title="Grocery list" description="Turn your meal plan into a combined grocery list, check items off and add your own." />;
  const supabase = await getServerSupabase();
  const today = isoDateInTz(new Date(), profile.timezone);
  const [itemsRes, listRes, plan] = await Promise.all([
    supabase.from("grocery_items").select("id, name, quantity, unit, note, checked, origin, position, created_at").eq("user_id", user.id).order("position").order("created_at"),
    supabase.from("grocery_lists").select("from_date, to_date, generated_at").eq("user_id", user.id).maybeSingle(),
    loadCurrentPlan(supabase, user.id, today).catch((err) => {
      logError("grocery.plan", err);
      return null;
    }),
  ]);
  if (itemsRes.error) logError("grocery.page", itemsRes.error);
  const items: GroceryItemView[] = (itemsRes.data ?? []).map((i) => ({
    id: i.id as string,
    name: i.name as string,
    amount: i.quantity != null ? `${fmtQty(Number(i.quantity))}${i.unit ? ` ${i.unit as string}` : ""}` : ((i.unit as string | null) ?? null),
    note: (i.note as string | null) ?? null,
    checked: Boolean(i.checked),
    origin: i.origin as "plan" | "manual",
  }));
  const list = listRes.data;
  const defaultFrom = plan ? (plan.start_date > today ? plan.start_date : today) : today;
  const defaultTo = plan ? addDaysIso(plan.start_date, plan.days - 1) : addDaysIso(today, 6);

  return (
    <div className="space-y-6">
      <BackLink href="/nutrition">Food</BackLink>
      <PageHeader eyebrow="Food" title="Grocery list" description="Built from your meal plan for the dates you choose. The same ingredient across meals is combined when the units convert." />
      <FoodToolsNav current="/nutrition/grocery" />

      <section aria-labelledby="build-title" className="rounded-2xl border border-gold-muted/60 bg-card-gradient p-4">
        <h2 id="build-title" className="mb-3 text-lg font-semibold">
          Build from your plan
        </h2>
        {plan ? (
          <GenerateGroceryForm defaultFrom={defaultFrom < defaultTo ? defaultFrom : plan.start_date} defaultTo={defaultTo} />
        ) : (
          <p className="text-[0.9375rem] text-muted-foreground">
            No meal plan yet.{" "}
            <Link href="/nutrition/planner" className="font-semibold text-gold-highlight underline">
              Make a plan
            </Link>{" "}
            first, or add items by hand below.
          </p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">Building again replaces the items from the plan and keeps the ones you added.</p>
      </section>

      <section aria-labelledby="list-title" className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="list-title" className="text-lg font-semibold">
            Your list
          </h2>
          {items.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {items.some((i) => i.checked) && (
                <ActionButton action={clearGroceryAction} fields={{ scope: "checked" }} size="sm" variant="ghost" confirmMessage="Remove the checked items?" confirmLabel="Remove">
                  Clear checked
                </ActionButton>
              )}
              <ActionButton action={clearGroceryAction} fields={{ scope: "all" }} size="sm" variant="ghost" confirmMessage="Clear the whole grocery list?" confirmDetail="Items you added by hand are removed too." confirmLabel="Clear list">
                Clear list
              </ActionButton>
            </div>
          )}
        </div>
        {list?.from_date && list.to_date && (
          <p className="mb-2 text-sm text-muted-foreground">
            From your plan for {formatLongDate(list.from_date as string)} – {formatLongDate(list.to_date as string)}.
          </p>
        )}
        {itemsRes.error ? (
          <Notice tone="error">Your list couldn&apos;t be loaded right now. Refresh the page to try again.</Notice>
        ) : items.length === 0 ? (
          <p className="text-[0.9375rem] text-muted-foreground">Your grocery list is empty.</p>
        ) : (
          <GroceryItems items={items} />
        )}
        <div className="mt-4 border-t border-border pt-4">
          <AddGroceryItemForm />
        </div>
      </section>

      <section aria-labelledby="cost-title" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="cost-title" className="text-lg font-semibold">
          Cost
        </h2>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground" data-testid="grocery-cost">
          No cost estimate. We don&apos;t have a sourced, dated price table (such as USDA or Bureau of Labor Statistics average retail prices) built in yet, and we won&apos;t show a price we can&apos;t back up. The planner&apos;s budget setting is a rough guide by ingredient type, not a price.
        </p>
      </section>
    </div>
  );
}
