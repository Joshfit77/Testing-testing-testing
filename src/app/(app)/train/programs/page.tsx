import Link from "next/link";
import { ChevronRight, Clock, Dumbbell, Lock, Search, ShieldAlert, SlidersHorizontal, Trash2, Wand2 } from "lucide-react";
import { MainHeader } from "@/components/shell/main-header";
import { EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { ActionButton } from "@/components/common/action-button";
import { BackLink } from "@/components/platform/back-link";
import { compareLibraryPrograms } from "@/lib/domain/disciplines";
import {
  activeFilterCount,
  catalogQuery,
  DAYS_FILTERS,
  EQUIPMENT_FILTERS,
  EXPERIENCE_FILTERS,
  equipmentSummary,
  filterCatalog,
  GOAL_FILTERS,
  MINUTES_FILTERS,
  parseCatalogFilters,
  requiredSessions,
  SPEC_CATEGORIES,
  specCategoriesFor,
  type CatalogFilters,
  type SpecCategoryId,
} from "@/lib/domain/program-catalog";
import { canAccessTier, hasFeature } from "@/lib/domain/plans";
import type { Plan } from "@/lib/domain/types";
import { cn, titleCase } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { removeSavedProgramAction } from "@/server/actions/programs";

export const metadata = { title: "Programs" };

interface ProgramCardRow {
  id: string;
  slug: string;
  name: string;
  summary: string;
  difficulty: string;
  duration_weeks: number;
  days_per_week: number;
  session_minutes: number;
  goals: string[];
  equipment: string[];
  tier: Plan;
  category_id: string | null;
  needs_specialist_review: boolean;
}

/** Old ?discipline= links (bookmarks, nav memory) land on the matching spec category. */
const DISCIPLINE_TO_CATEGORY: Record<string, SpecCategoryId> = {
  strength: "strength",
  strongman: "strongman",
  physique: "bodybuilding",
  combat: "combat",
  endurance: "endurance",
  speed_agility: "athletic",
  general: "beginner",
};

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters: CatalogFilters = parseCatalogFilters(sp);
  if (!filters.category && typeof sp.discipline === "string" && DISCIPLINE_TO_CATEGORY[sp.discipline]) filters.category = DISCIPLINE_TO_CATEGORY[sp.discipline];
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [plan, categoriesRes, programsRes, mineRes] = await Promise.all([
    getUserPlan(user.id),
    supabase.from("program_categories").select("id, slug, name").order("sort_order"),
    supabase
      .from("training_programs")
      .select("id, slug, name, summary, difficulty, duration_weeks, days_per_week, session_minutes, goals, equipment, tier, category_id, needs_specialist_review")
      .eq("is_published", true)
      .order("name"),
    supabase
      .from("user_programs")
      .select("id, status, current_week, program:training_programs(id, slug, name, duration_weeks, source)")
      .eq("user_id", user.id)
      .neq("status", "active")
      .order("updated_at", { ascending: false }),
  ]);
  const canBuild = hasFeature(plan, "custom_program_builder");
  const categories = (categoriesRes.data ?? []) as { id: string; slug: string; name: string }[];
  const categorySlug = new Map(categories.map((c) => [c.id, c.slug]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const all = ((programsRes.data ?? []) as ProgramCardRow[]).map((p) => ({
    ...p,
    category: p.category_id ? (categorySlug.get(p.category_id) ?? null) : null,
    categoryName: p.category_id ? (categoryName.get(p.category_id) ?? null) : null,
  }));
  const results = filterCatalog(all, filters).sort((a, b) => compareLibraryPrograms(a, b));
  // Group by spec category: a filtered category shows one group; otherwise each program sits under its own.
  const groups = SPEC_CATEGORIES.map((c) => ({
    category: c,
    items: results.filter((p) => (filters.category ? filters.category === c.id : specCategoriesFor(p)[0] === c.id)),
  })).filter((g) => g.items.length > 0);
  const nFilters = activeFilterCount(filters);
  const anyFilter = nFilters > 0 || Boolean(filters.q) || Boolean(filters.category);
  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold",
      active ? "border-gold bg-gold/10 text-gold-highlight" : "border-border text-muted-foreground hover:text-foreground",
    );
  const mine = (mineRes.data ?? []) as unknown as {
    id: string;
    status: string;
    current_week: number;
    program: { id: string; slug: string; name: string; duration_weeks: number; source: string } | null;
  }[];

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/train">Train</BackLink>
        <MainHeader title="Programs" subtitle="Search the library, filter it to your goal, schedule and equipment, or build your own." />
      </div>

      <Link href="/train/build" className="group flex items-center gap-3 rounded-2xl border border-gold-muted/60 bg-gold/5 p-4 hover:border-gold">
        <span className="rounded-xl bg-gold-gradient p-2.5 text-primary-foreground">
          <Wand2 className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Build my program</span>
          <span className="block text-sm text-muted-foreground">
            Built around your numbers, goals, schedule and equipment — including combined goals like strength + a 5K.{" "}
            {canBuild ? "" : "Included with Pro All Access."}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
      </Link>

      {mine.length > 0 && (
        <section aria-labelledby="mine-title">
          <h2 id="mine-title" className="mb-2 text-lg font-semibold">
            My programs
          </h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {mine.map(
              (m) =>
                m.program && (
                  <li key={m.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 pl-4">
                    <Link href={`/train/programs/${m.program.slug}`} className="min-w-0 hover:text-gold-highlight">
                      <p className="truncate font-semibold">{m.program.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {titleCase(m.status)}
                        {m.program.source !== "curated" &&
                          ` · ${m.program.source === "ai" ? "AI-generated" : m.program.source === "custom" ? "Custom built" : "Personal starter"}`}
                        {m.status === "paused" && ` · week ${m.current_week}`}
                      </p>
                    </Link>
                    <ActionButton action={removeSavedProgramAction} fields={{ userProgramId: m.id }} variant="ghost" size="icon-sm" aria-label={`Remove ${m.program.name} from my programs`} confirmMessage={`Remove ${m.program.name} from My programs?`} confirmDetail="Workouts you already logged stay in your history." confirmLabel="Remove">
                      <Trash2 aria-hidden />
                    </ActionButton>
                  </li>
                ),
            )}
          </ul>
        </section>
      )}

      <section id="library" aria-labelledby="library-title" className="scroll-mt-24 space-y-3">
        <h2 id="library-title" className="text-lg font-semibold">
          Program library
        </h2>

        <form role="search" action="/train/programs" className="space-y-2" aria-label="Search and filter programs">
          {filters.category && <input type="hidden" name="category" value={filters.category} />}
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search programs</span>
              <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
              <Input name="q" type="search" defaultValue={filters.q ?? ""} placeholder="Search programs" className="pl-9" maxLength={60} />
            </label>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </div>
          <details className="rounded-2xl border border-border bg-card" open={nFilters > 0}>
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 text-sm font-semibold">
              <SlidersHorizontal className="size-4 text-gold" aria-hidden /> Filters{nFilters > 0 ? ` (${nFilters})` : ""}
            </summary>
            <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3 lg:grid-cols-5">
              <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                Goal
                <NativeSelect name="goal" defaultValue={filters.goal ?? ""} aria-label="Goal">
                  <option value="">Any goal</option>
                  {GOAL_FILTERS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                Experience
                <NativeSelect name="experience" defaultValue={filters.experience ?? ""} aria-label="Experience">
                  <option value="">Any level</option>
                  {EXPERIENCE_FILTERS.map((x) => (
                    <option key={x} value={x}>
                      {titleCase(x)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="col-span-2 space-y-1 text-xs font-semibold text-muted-foreground sm:col-span-1">
                Equipment I have
                <NativeSelect name="equipment" defaultValue={filters.equipment ?? ""} aria-label="Equipment I have">
                  <option value="">Full gym / any</option>
                  {EQUIPMENT_FILTERS.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                Days per week
                <NativeSelect name="days" defaultValue={filters.days ?? ""} aria-label="Days per week">
                  <option value="">Any</option>
                  {DAYS_FILTERS.map((d) => (
                    <option key={d} value={d}>
                      Up to {d} days
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                Session length
                <NativeSelect name="minutes" defaultValue={filters.minutes ?? ""} aria-label="Session length">
                  <option value="">Any</option>
                  {MINUTES_FILTERS.map((m) => (
                    <option key={m} value={m}>
                      Up to {m} min
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <div className="col-span-2 flex gap-2 sm:col-span-3 lg:col-span-5">
                <Button type="submit" className="flex-1 sm:flex-none">
                  Apply filters
                </Button>
                {anyFilter && (
                  <Button asChild variant="ghost">
                    <Link href="/train/programs#library">Clear all</Link>
                  </Button>
                )}
              </div>
            </div>
          </details>
        </form>

        <nav aria-label="Program categories" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Link href={`/train/programs${catalogQuery({ ...filters, category: undefined })}#library`} aria-current={!filters.category ? "page" : undefined} className={chip(!filters.category)}>
            All
          </Link>
          {/* The selected category comes first so it's visible without scrolling the chip row. */}
          {[...SPEC_CATEGORIES].sort((a, b) => Number(b.id === filters.category) - Number(a.id === filters.category)).map((c) => (
            <Link key={c.id} href={`/train/programs${catalogQuery({ ...filters, category: c.id })}#library`} aria-current={filters.category === c.id ? "page" : undefined} className={chip(filters.category === c.id)}>
              {c.label}
            </Link>
          ))}
        </nav>

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {results.length} {results.length === 1 ? "program" : "programs"}
          {anyFilter ? " match" : ""}
        </p>

        {results.length === 0 ? (
          <EmptyState
            title="No programs match"
            description="Try fewer filters, a different search, or build a program around exactly what you have."
            action={
              <Button asChild variant="secondary">
                <Link href="/train/programs#library">Clear filters</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            {groups.map(({ category: c, items }) => (
              <section key={c.id} aria-labelledby={`cat-${c.id}`}>
                <h3 id={`cat-${c.id}`} className="mb-2 font-display text-lg font-bold uppercase leading-tight">
                  {c.label}
                </h3>
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((p) => {
                    const locked = !canAccessTier(plan, p.tier);
                    const { total, required } = requiredSessions(p.days_per_week, p.duration_weeks);
                    return (
                      <li key={p.id}>
                        <Link href={`/train/programs/${p.slug}`} className="bg-card-gradient flex h-full flex-col rounded-2xl border border-border p-4 hover:border-gold-muted">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-gold">{p.categoryName ?? "Program"}</p>
                            {locked ? (
                              <Badge>
                                <Lock className="size-3" aria-hidden /> {titleCase(p.tier)}
                              </Badge>
                            ) : (
                              p.tier === "free" && <Badge variant="success">Free</Badge>
                            )}
                          </div>
                          <h4 className="mt-1.5 font-display text-lg font-bold uppercase leading-tight">{p.name}</h4>
                          <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{p.summary}</p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <Badge variant="secondary">{titleCase(p.difficulty)}</Badge>
                            <Badge variant="secondary">
                              {p.duration_weeks} {p.duration_weeks === 1 ? "week" : "weeks"}
                            </Badge>
                            <Badge variant="secondary">{p.days_per_week}×/week</Badge>
                            <Badge variant="secondary">
                              <Clock className="size-3" aria-hidden /> ~{p.session_minutes} min
                            </Badge>
                          </div>
                          <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                            <div className="flex gap-1.5">
                              <dt>
                                <Dumbbell className="mt-0.5 size-3.5 text-gold" aria-label="Equipment" />
                              </dt>
                              <dd>{equipmentSummary(p.equipment)}</dd>
                            </div>
                            <div>
                              <dt className="inline font-semibold text-foreground/80">Complete: </dt>
                              <dd className="inline">{p.duration_weeks <= 1 ? `all ${total} sessions` : `${required} of ${total} sessions (80%)`}</dd>
                            </div>
                          </dl>
                          {p.needs_specialist_review && (
                            <p className="mt-2 flex items-center gap-1.5 text-xs text-gold-highlight">
                              <ShieldAlert className="size-3.5 shrink-0" aria-hidden /> Not yet reviewed by a qualified coach
                            </p>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
