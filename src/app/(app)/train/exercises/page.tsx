import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EQUIPMENT, EQUIPMENT_LABELS } from "@/lib/domain/types";
import { titleCase } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { ExerciseThumb } from "@/components/train/exercise-demo";
import { BackLink } from "@/components/platform/back-link";

export const metadata = { title: "Exercise library" };

const CATEGORIES = [
  "strength",
  "conditioning",
  "mobility",
  "plyometric",
  "cardio",
  "core",
] as const;

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; equipment?: string }>;
}) {
  const sp = await searchParams;
  await requireOnboardedUser();
  const supabase = await getServerSupabase();
  let query = supabase
    .from("exercises")
    .select(
      "slug, name, category, difficulty, primary_muscles, equipment, movement_pattern"
    )
    .eq("is_published", true)
    .order("name");
  const q = (sp.q ?? "").trim().slice(0, 60);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  if (sp.category && (CATEGORIES as readonly string[]).includes(sp.category))
    query = query.eq("category", sp.category);
  if (sp.equipment && (EQUIPMENT as readonly string[]).includes(sp.equipment))
    query = query.contains("equipment", [sp.equipment]);
  const { data, error } = await query;
  const exercises = data ?? [];

  return (
    <div className="space-y-6">
      <BackLink href="/train">Train</BackLink>
      <PageHeader
        title="Exercise library"
        description="Technique guides, form cues, common mistakes and alternatives."
      />

      <form
        className="grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-[1fr_180px_200px_auto]"
        role="search"
      >
        <label className="relative">
          <span className="sr-only">Search exercises</span>
          <Search
            className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search exercises"
            className="pl-9"
          />
        </label>
        <NativeSelect
          name="category"
          defaultValue={sp.category ?? ""}
          aria-label="Category"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {titleCase(c)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          name="equipment"
          defaultValue={sp.equipment ?? ""}
          aria-label="Equipment"
        >
          <option value="">Any equipment</option>
          {EQUIPMENT.map((e) => (
            <option key={e} value={e}>
              {EQUIPMENT_LABELS[e]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

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
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {exercises.map((e) => (
              <li key={e.slug as string}>
                <Link
                  href={`/train/exercises/${e.slug}`}
                  className="flex h-full gap-3 rounded-2xl border border-border bg-card p-4 hover:border-gold-muted"
                >
                  <div
                    className="relative h-[66px] w-[88px] shrink-0 overflow-hidden rounded-lg border border-border"
                    aria-hidden
                  >
                    <ExerciseThumb
                      slug={e.slug as string}
                      name={e.name as string}
                      meta={{
                        name: e.name as string,
                        pattern: e.movement_pattern as string,
                        category: e.category as string,
                        equipment: e.equipment as string[],
                      }}
                      className="h-full w-full"
                    />
                    <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] font-semibold uppercase tracking-wider text-gold-highlight">
                      Demo
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <p className="font-semibold">{e.name as string}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(e.primary_muscles as string[])
                        .map(titleCase)
                        .join(", ")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">
                        {titleCase(e.category as string)}
                      </Badge>
                      <Badge variant="outline">
                        {titleCase(e.difficulty as string)}
                      </Badge>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
