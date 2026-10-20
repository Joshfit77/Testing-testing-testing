import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Lock, Trash2, Wand2 } from "lucide-react";
import { MainHeader } from "@/components/shell/main-header";
import { EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/common/action-button";
import { DISCIPLINES, compareLibraryPrograms, disciplineForCategory, getDiscipline, groupByDiscipline } from "@/lib/domain/disciplines";
import { canAccessTier } from "@/lib/domain/plans";
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
  tier: Plan;
  category_id: string | null;
}

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ category?: string; discipline?: string }> }) {
  const { category, discipline } = await searchParams;
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [plan, categoriesRes, programsRes, mineRes] = await Promise.all([
    getUserPlan(user.id),
    supabase.from("program_categories").select("id, slug, name").order("sort_order"),
    supabase
      .from("training_programs")
      .select("id, slug, name, summary, difficulty, duration_weeks, days_per_week, session_minutes, tier, category_id")
      .eq("is_published", true)
      .order("name"),
    supabase
      .from("user_programs")
      .select("id, status, current_week, program:training_programs(id, slug, name, duration_weeks, source)")
      .eq("user_id", user.id)
      .neq("status", "active")
      .order("updated_at", { ascending: false }),
  ]);
  const categories = (categoriesRes.data ?? []) as { id: string; slug: string; name: string }[];
  const selected = categories.find((c) => c.slug === category);
  const categorySlug = new Map(categories.map((c) => [c.id, c.slug]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const disciplineOf = (p: ProgramCardRow) => disciplineForCategory(p.category_id ? categorySlug.get(p.category_id) : null);
  // A category filter implies its discipline; otherwise ?discipline= narrows the library to one group.
  const activeDiscipline = selected ? disciplineForCategory(selected.slug) : getDiscipline(discipline);
  const allPrograms = (programsRes.data ?? []) as ProgramCardRow[];
  const libraryKey = (p: ProgramCardRow) => ({ category: p.category_id ? categorySlug.get(p.category_id) : null, difficulty: p.difficulty, name: p.name });
  const programs = allPrograms
    .filter((p) => (selected ? p.category_id === selected.id : !activeDiscipline || disciplineOf(p).id === activeDiscipline.id))
    .sort((a, b) => compareLibraryPrograms(libraryKey(a), libraryKey(b)));
  const groups = groupByDiscipline(programs, disciplineOf);
  const disciplineCategories = activeDiscipline ? categories.filter((c) => activeDiscipline.categories.includes(c.slug)) : [];
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
    <div className="space-y-8">
      <div>
        <Link href="/train" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden /> Train
        </Link>
        <MainHeader title="Programs" subtitle="Your saved programs and the full library, grouped by discipline." />
      </div>

      <Link
        href="/train/build"
        className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-gold-muted/60 bg-gold/5 p-5 transition-all hover:-translate-y-0.5 hover:border-gold"
      >
        <span className="rounded-2xl bg-gold-gradient p-3 text-primary-foreground">
          <Wand2 className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl font-bold uppercase leading-tight">Build my program</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            Strength &amp; powerlifting, strongman, bodybuilding &amp; physique, combat sports, endurance, speed &amp; agility — built around
            your numbers, goals, schedule and equipment. Free on every plan.
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-gold transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>

      {mine.length > 0 && (
        <section aria-labelledby="mine-title">
          <h2 id="mine-title" className="mb-3 font-display text-xl font-bold uppercase">
            My programs
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {mine.map(
              (m) =>
                m.program && (
                  <li key={m.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
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

      <section id="library" aria-labelledby="library-title" className="scroll-mt-24">
        <h2 id="library-title" className="mb-3 font-display text-xl font-bold uppercase">
          Program library
        </h2>
        <p className="-mt-1 mb-3 text-sm text-muted-foreground">Programs grouped by discipline. Pick a discipline to see who it&apos;s for and what a week looks like.</p>
        <nav aria-label="Program disciplines" className="scrollbar-none -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          <Link href="/train/programs#library" aria-current={!activeDiscipline ? "page" : undefined} className={chip(!activeDiscipline)}>
            All
          </Link>
          {DISCIPLINES.map((d) => (
            <Link
              key={d.id}
              href={`/train/programs?discipline=${d.id}#library`}
              aria-current={activeDiscipline?.id === d.id && !selected ? "page" : undefined}
              className={chip(activeDiscipline?.id === d.id)}
            >
              {d.label}
            </Link>
          ))}
        </nav>
        {disciplineCategories.length > 1 && (
          <nav aria-label="Program categories" className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Link href={`/train/programs?discipline=${activeDiscipline!.id}#library`} aria-current={!selected ? "page" : undefined} className={chip(!selected)}>
              All {activeDiscipline!.label}
            </Link>
            {disciplineCategories.map((c) => (
              <Link key={c.id} href={`/train/programs?category=${c.slug}#library`} aria-current={selected?.id === c.id ? "page" : undefined} className={chip(selected?.id === c.id)}>
                {c.name}
              </Link>
            ))}
          </nav>
        )}
        {programs.length === 0 ? (
          <EmptyState title="No programs in this category yet" description="Check back soon, or explore another category." />
        ) : (
          <div className="space-y-8">
            {groups.map(({ discipline: d, items }) => (
              <section key={d.id} aria-labelledby={`dsc-${d.id}`}>
                <div className="mb-3 rounded-2xl border border-border bg-card/60 p-4">
                  <h3 id={`dsc-${d.id}`} className="font-display text-lg font-bold uppercase leading-tight">
                    {d.label}
                  </h3>
                  <dl className="mt-1.5 grid gap-1 text-xs text-muted-foreground md:grid-cols-2 md:gap-4">
                    <div>
                      <dt className="inline font-semibold text-foreground/80">Who it&apos;s for: </dt>
                      <dd className="inline">{d.whoFor}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold text-foreground/80">A typical week: </dt>
                      <dd className="inline">{d.typicalWeek}</dd>
                    </div>
                  </dl>
                  {d.customTypes.length > 0 && (
                    <Link href={`/train/build?type=${d.customTypes[0]}`} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gold hover:text-gold-highlight">
                      <Wand2 className="size-3.5" aria-hidden /> Build a custom {d.label.toLowerCase()} program
                    </Link>
                  )}
                </div>
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((p) => {
                    const locked = !canAccessTier(plan, p.tier);
                    return (
                      <li key={p.id}>
                        <Link
                          href={`/train/programs/${p.slug}`}
                          className="bg-card-gradient flex h-full flex-col rounded-2xl border border-border p-5 transition-all hover:-translate-y-0.5 hover:border-gold-muted"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-gold">{p.category_id ? categoryName.get(p.category_id) : "Program"}</p>
                            {locked ? (
                              <Badge>
                                <Lock className="size-3" aria-hidden /> {titleCase(p.tier)}
                              </Badge>
                            ) : (
                              p.tier === "free" && <Badge variant="success">Free</Badge>
                            )}
                          </div>
                          <h4 className="mt-2 font-display text-xl font-bold uppercase leading-tight">{p.name}</h4>
                          <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.summary}</p>
                          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary">{titleCase(p.difficulty)}</Badge>
                            <Badge variant="secondary">
                              {p.duration_weeks} {p.duration_weeks === 1 ? "week" : "weeks"}
                            </Badge>
                            <Badge variant="secondary">{p.days_per_week}×/week</Badge>
                            <Badge variant="secondary">
                              <Clock className="size-3" aria-hidden /> {p.session_minutes} min
                            </Badge>
                          </div>
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
