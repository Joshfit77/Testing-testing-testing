import Link from "next/link";
import { BookOpen, ChevronRight, CookingPot, Dumbbell, History, LayoutList, NotebookPen, Search, Utensils } from "lucide-react";
import { BackLink } from "@/components/platform/back-link";
import { PageHeader } from "@/components/common/page-header";
import { ScriptureText } from "@/components/bible/scripture-text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { APP_RECIPES } from "@/data/app-recipes";
import { COMMON_FOODS } from "@/data/foods";
import { PROGRAMS } from "@/data/programs";
import { prepareEntry, rankFoods } from "@/lib/domain/food-search";
import { hasFeature } from "@/lib/domain/plans";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { searchPersonal, type PersonalResults } from "@/server/services/personal-search";
import { searchBible } from "@/server/bible/text";
import { bookById, chapterHref } from "@/lib/bible/books";

export const metadata = { title: "Search" };

/** Screens and settings a member might look for by name (the search covers the app, not only its content). */
const SCREENS: { name: string; href: string; hint: string }[] = [
  { name: "Notifications", href: "/profile/notifications", hint: "Reminders for Faith, workouts, food, water and recovery; quiet hours" },
  { name: "Plans & billing", href: "/profile/billing", hint: "Membership, subscription, cancel or change plan" },
  { name: "Goals & training preferences", href: "/profile/preferences", hint: "Goal, experience, schedule, equipment, diet" },
  { name: "Customize Home", href: "/profile/customize", hint: "Choose and order what Home and Faith show" },
  { name: "Account & units", href: "/profile#account", hint: "Name, units, height, time zone, password" },
  { name: "Display: text size, reduce motion", href: "/profile#display", hint: "Larger text, fewer animations" },
  { name: "Privacy & data, export, delete account", href: "/profile#privacy", hint: "Download your data, consents, delete" },
  { name: "My Progress", href: "/progress", hint: "Overview, body map, photos, badges, history" },
  { name: "Badges", href: "/progress/badges", hint: "Milestones earned and what's next" },
  { name: "Sleep & Recovery", href: "/progress/sleep", hint: "Nightly reports, sleep debt, schedule, energy" },
  { name: "Body Scan", href: "/progress/body-scan", hint: "Guided photos and measurements" },
  { name: "Strength & Body Map", href: "/progress/body-map", hint: "Muscle map and strength ranks" },
  { name: "Training calendar", href: "/calendar", hint: "Planned sessions, runs, walks, rest days" },
  { name: "Run & walk", href: "/run", hint: "GPS runs and walks, running plans, records" },
  { name: "Program builder", href: "/train/build", hint: "Build a program around your goals" },
  { name: "Workout history", href: "/train/history", hint: "Every completed workout" },
  { name: "My workouts (templates)", href: "/train/templates", hint: "Saved workouts to start again" },
  { name: "Recovery", href: "/train/recovery", hint: "Readiness and recovery check-ins" },
  { name: "Training review", href: "/train/review", hint: "How your training is going" },
  { name: "Barcode scanner / Nutrition Score", href: "/nutrition/scanner", hint: "Scan a packaged food" },
  { name: "Meal photo", href: "/nutrition/photo", hint: "Log a meal from a photo" },
  { name: "Recipes", href: "/nutrition/recipes", hint: "Recipes with servings and macros" },
  { name: "Meal planner", href: "/nutrition/planner", hint: "Plan meals for the week" },
  { name: "Grocery list", href: "/nutrition/grocery", hint: "From your planned meals" },
  { name: "Supplements", href: "/nutrition/supplements", hint: "Evidence, doses and your stack" },
  { name: "Diets", href: "/nutrition/diets", hint: "Choose your eating style" },
  { name: "Nutrition insights", href: "/nutrition/insights", hint: "Weekly averages and trends" },
  { name: "Bible", href: "/faith/bible", hint: "Read, search, highlight, take notes" },
  { name: "Prayer journal", href: "/faith/journal", hint: "Prayers, praise and reflections" },
  { name: "Reading journey", href: "/faith/journey", hint: "Read through Scripture in 30 to 365 days" },
  { name: "Scripture memory", href: "/faith/memory", hint: "Memorize verses" },
  { name: "Bible studies", href: "/faith/studies", hint: "Guided studies" },
  { name: "Ask the Bible", href: "/faith/ask", hint: "Questions answered from Scripture" },
  { name: "40 Days Through the Narrow Gate", href: "/faith#todays-devotional", hint: "The daily devotional challenge" },
  { name: "AI Coach", href: "/coach", hint: "Ask about training, food, recovery" },
];

type Row = { href: string; title: string; body?: React.ReactNode };

function Group({ title, icon: Icon, rows, more }: { title: string; icon: typeof Search; rows: Row[]; more?: { href: string; label: string } }) {
  if (!rows.length) return null;
  return (
    <section aria-labelledby={`search-${title}`} className="rounded-2xl border border-border bg-card">
      <h2 id={`search-${title}`} className="flex items-center gap-2 px-4 pt-3 text-sm font-semibold text-muted-foreground">
        <Icon className="size-4 text-gold" aria-hidden /> {title}
      </h2>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.href + r.title}>
            <Link href={r.href} className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-elevated/50">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{r.title}</span>
                {r.body && <span className="block text-sm text-muted-foreground">{r.body}</span>}
              </span>
              <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {more && (
        <Link href={more.href} className="flex min-h-11 items-center justify-center border-t border-border text-sm font-semibold text-gold-highlight hover:underline">
          {more.label}
        </Link>
      )}
    </section>
  );
}

/**
 * One search for the whole app: exercises, programs, foods, recipes, the Bible and the app's own screens and
 * settings. Each group links into the screen that already handles it (the exercise page, the Bible reader, the
 * Nutrition tab with the food dialog open), so nothing here is a second copy of a feature.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 80);
  const { user, profile } = await requireOnboardedUser();
  let personal: PersonalResults = { workouts: [], meals: [], journal: [] };
  let exercises: Row[] = [];
  let programs: Row[] = [];
  let foods: Row[] = [];
  let recipes: Row[] = [];
  let screens: Row[] = [];
  let bible: { rows: Row[]; total: number } = { rows: [], total: 0 };
  if (query.length >= 2) {
    const supabase = await getServerSupabase();
    // The member's own things first: their client (row-level security) and their id, never anyone else's rows.
    const plan = await getUserPlan(user.id);
    personal = await searchPersonal(supabase, user.id, query, { nutritionTools: hasFeature(plan, "nutrition_tracking"), timeZone: profile.timezone ?? "UTC" });
    const { data: ex } = await supabase.from("exercises").select("slug, name, category, primary_muscles").eq("is_published", true);
    const exRows = (ex ?? []) as { slug: string; name: string; category: string; primary_muscles: string[] | null }[];
    exercises = rankFoods(exRows, query, (e) => prepareEntry(`${e.name} ${e.category} ${(e.primary_muscles ?? []).join(" ")}`), 6).map((e) => ({
      href: `/train/exercises/${e.slug}`,
      title: e.name,
      body: [e.category, ...(e.primary_muscles ?? []).slice(0, 2)].filter(Boolean).join(" · "),
    }));
    programs = rankFoods(PROGRAMS, query, (p) => prepareEntry(`${p.name} ${p.summary} ${p.category}`), 5).map((p) => ({ href: `/train/programs/${p.slug}`, title: p.name, body: p.summary }));
    foods = rankFoods(COMMON_FOODS, query, (f) => prepareEntry(f.name), 5).map((f) => ({
      href: "/nutrition?add=1",
      title: f.name,
      body: `${f.calories} kcal · P ${f.protein_g} g per ${f.servingSize} ${f.servingUnit} · opens Add food`,
    }));
    recipes = rankFoods(APP_RECIPES, query, (r) => prepareEntry(r.name), 4).map((r) => ({ href: `/nutrition/recipes/app/${r.slug}`, title: r.name }));
    screens = rankFoods(SCREENS, query, (s) => prepareEntry(`${s.name} ${s.hint}`), 6).map((s) => ({ href: s.href, title: s.name, body: s.hint }));
    const hits = searchBible(query, { limit: 5 });
    bible = {
      total: hits.total,
      rows: hits.hits.map((h) => ({
        href: bookById(h.bookId) ? chapterHref(bookById(h.bookId)!, h.chapter, h.verse) : "/faith/bible",
        title: h.reference,
        body: <ScriptureText text={h.text} jesus={h.jesus} />,
      })),
    };
  }
  const total = exercises.length + programs.length + foods.length + recipes.length + screens.length + bible.rows.length + personal.workouts.length + personal.meals.length + personal.journal.length;

  return (
    <div className="space-y-4">
      <BackLink href="/home">Home</BackLink>
      <PageHeader title="Search" description="Your workouts, saved meals and prayers; exercises, programs, foods, recipes, the Bible, and every screen and setting." className="mb-2" />
      <form action="/search" method="get" role="search" className="flex gap-2">
        <label htmlFor="search-q" className="sr-only">
          Search
        </label>
        <Input id="search-q" name="q" type="search" defaultValue={query} placeholder="e.g. squat, banana, John 3:16, notifications" autoFocus className="h-12 text-base" />
        <Button type="submit" className="h-12">
          <Search aria-hidden /> Search
        </Button>
      </form>
      {query.length >= 2 && total === 0 && <p className="text-sm text-muted-foreground">Nothing matched &ldquo;{query}&rdquo;. Try a shorter word, or a book and chapter for the Bible.</p>}
      <Group title="Your workouts" icon={History} rows={personal.workouts} more={{ href: "/train/history", label: "Workout history" }} />
      <Group title="Your saved meals, recipes & foods" icon={Utensils} rows={personal.meals} more={{ href: "/nutrition/saved-meals", label: "Saved meals" }} />
      <Group title="Your prayer journal" icon={NotebookPen} rows={personal.journal} more={{ href: "/faith/journal", label: "Prayer journal" }} />
      <Group title="Screens & settings" icon={LayoutList} rows={screens} />
      <Group title="Exercises" icon={Dumbbell} rows={exercises} more={{ href: `/train/exercises?q=${encodeURIComponent(query)}`, label: "All exercises" }} />
      <Group title="Programs" icon={Dumbbell} rows={programs} more={{ href: "/train/programs", label: "Program library" }} />
      <Group title="Foods" icon={Utensils} rows={foods} more={{ href: "/nutrition?add=1", label: "Search all foods and barcodes" }} />
      <Group title="Recipes" icon={CookingPot} rows={recipes} more={{ href: "/nutrition/recipes", label: "All recipes" }} />
      <Group title={bible.total ? `Bible (${bible.total.toLocaleString("en-US")} verses)` : "Bible"} icon={BookOpen} rows={bible.rows} more={{ href: `/faith/bible/search?q=${encodeURIComponent(query)}`, label: "All Bible results" }} />
      {query.length < 2 && (
        <p className="text-sm text-muted-foreground">
          <BookOpen className="mr-1 inline size-4 text-gold" aria-hidden /> Type at least two letters. Your own workouts, saved meals and prayer entries come first (only yours, never anyone else&apos;s); Bible results open the chapter at the verse; foods open the Nutrition tab&apos;s Add food dialog.
        </p>
      )}
    </div>
  );
}
