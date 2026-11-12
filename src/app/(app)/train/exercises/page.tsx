import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EQUIPMENT, EQUIPMENT_LABELS } from "@/lib/domain/types";
import { cn, titleCase } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { ExerciseThumb } from "@/components/train/exercise-demo";
import { demoReadiness } from "@/lib/exercise-demo-readiness";
import { MUSCLE_GROUPS, muscleGroup } from "@/lib/domain/muscle-groups";
import { BackLink } from "@/components/platform/back-link";

export const metadata = { title: "Exercise library" };

const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

const CATEGORIES = [
  "strength",
  "conditioning",
  "mobility",
  "plyometric",
  "cardio",
  "core",
] as const;

/** The library URL for a set of filters (empty ones left out). */
function libraryHref(f: { q?: string; category?: string; difficulty?: string; equipment?: string; muscle?: string }) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
  const qs = params.toString();
  return `/train/exercises${qs ? `?${qs}` : ""}`;
}

const chip = (active: boolean) =>
  cn(
    "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[0.9375rem] font-semibold transition-colors",
    active ? "bg-gold-gradient text-black shadow-bronze" : "border border-border bg-[#101010] text-foreground/85 hover:text-foreground",
  );

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; equipment?: string; muscle?: string; difficulty?: string }>;
}) {
  const sp = await searchParams;
  await requireOnboardedUser();
  const supabase = await getServerSupabase();
  let query = supabase
    .from("exercises")
    .select(
      "slug, name, category, difficulty, primary_muscles, secondary_muscles, equipment, movement_pattern"
    )
    .eq("is_published", true)
    .order("name");
  const q = (sp.q ?? "").trim().slice(0, 60);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  if (sp.category && (CATEGORIES as readonly string[]).includes(sp.category))
    query = query.eq("category", sp.category);
  if (sp.equipment && (EQUIPMENT as readonly string[]).includes(sp.equipment))
    query = query.contains("equipment", [sp.equipment]);
  const group = muscleGroup(sp.muscle);
  if (group) query = query.overlaps("primary_muscles", [...group.muscles]);
  if (sp.difficulty && (DIFFICULTIES as readonly string[]).includes(sp.difficulty)) query = query.eq("difficulty", sp.difficulty);
  const { data, error } = await query;
  const exercises = data ?? [];
  // Only valid values are carried into links and the form.
  const category = sp.category && (CATEGORIES as readonly string[]).includes(sp.category) ? sp.category : "";
  const difficulty = sp.difficulty && (DIFFICULTIES as readonly string[]).includes(sp.difficulty) ? sp.difficulty : "";
  const equipment = sp.equipment && (EQUIPMENT as readonly string[]).includes(sp.equipment) ? sp.equipment : "";
  const moreFilters = [category, difficulty, equipment].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <BackLink href="/train">Train</BackLink>
      <PageHeader
        title="Exercise library"
        description="Technique guides, form cues, common mistakes and alternatives."
      />

      <form className="space-y-2" role="search" aria-label="Search and filter exercises">
        {group && <input type="hidden" name="muscle" value={group.id} />}
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search exercises</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
            <Input name="q" type="search" defaultValue={q} placeholder="Search exercises" className="pl-9" maxLength={60} />
          </label>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </div>
        {/* Category, difficulty and equipment are the less common filters: one tap away, applied together. */}
        <details className="rounded-2xl border border-border bg-card" open={moreFilters > 0}>
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 text-sm font-semibold">
            <SlidersHorizontal className="size-4 text-gold" aria-hidden /> More filters{moreFilters > 0 ? ` (${moreFilters})` : ""}
          </summary>
          <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3">
            <NativeSelect name="category" defaultValue={category} aria-label="Category">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {titleCase(c)}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect name="difficulty" defaultValue={difficulty} aria-label="Difficulty">
              <option value="">Any difficulty</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {titleCase(d)}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect name="equipment" defaultValue={equipment} aria-label="Equipment" className="col-span-2 sm:col-span-1">
              <option value="">Any equipment</option>
              {EQUIPMENT.map((e) => (
                <option key={e} value={e}>
                  {EQUIPMENT_LABELS[e]}
                </option>
              ))}
            </NativeSelect>
            <div className="col-span-2 flex gap-2 sm:col-span-3">
              <Button type="submit" className="flex-1 sm:flex-none">
                Apply filters
              </Button>
              {(moreFilters > 0 || q || group) && (
                <Button asChild variant="ghost">
                  <Link href="/train/exercises">Clear all</Link>
                </Button>
              )}
            </div>
          </div>
        </details>
      </form>

      {/* Muscle group: one tap, no submit (keeps the search and the other filters). */}
      <nav aria-label="Muscles" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Link href={libraryHref({ q, category, difficulty, equipment })} aria-current={!group ? "page" : undefined} className={chip(!group)}>
          All
        </Link>
        {MUSCLE_GROUPS.map((g) => (
          <Link key={g.id} href={libraryHref({ q, category, difficulty, equipment, muscle: g.id })} aria-current={group?.id === g.id ? "page" : undefined} className={chip(group?.id === g.id)}>
            {g.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <EmptyState
          title="Couldn't load exercises"
          description="Please try again in a moment."
        />
      ) : exercises.length === 0 ? (
        <EmptyState
          title="No exercises match"
          description="Try a different search or clear the filters."
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {exercises.length} exercises
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {exercises.map((e) => {
              const poses = demoReadiness(e.slug as string) === "poses";
              return (
                <li key={e.slug as string} className="min-w-0">
                  <Link href={`/train/exercises/${e.slug}`} className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-3 py-1.5 hover:border-gold-muted">
                    <div className="relative h-11 w-14 shrink-0 overflow-hidden rounded-md border border-border" aria-hidden>
                      <ExerciseThumb
                        slug={e.slug as string}
                        name={e.name as string}
                        meta={{
                          name: e.name as string,
                          pattern: e.movement_pattern as string,
                          category: e.category as string,
                          equipment: e.equipment as string[],
                        }}
                        muscles={{ primary: (e.primary_muscles as string[] | null) ?? [], secondary: (e.secondary_muscles as string[] | null) ?? [] }}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{e.name as string}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[(e.primary_muscles as string[]).map(titleCase).join(", "), titleCase(e.category as string), poses ? "Poses" : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
