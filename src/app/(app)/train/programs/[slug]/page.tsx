import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Flame, Lock, Play, Repeat, Snowflake, TrendingUp } from "lucide-react";
import { Notice } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgramActions } from "@/components/train/program-actions";
import { canAccessTier } from "@/lib/domain/plans";
import { formatDuration } from "@/lib/domain/units";
import type { ProgramRow } from "@/lib/types/db";
import { cn, titleCase } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";

export const metadata = { title: "Program" };

interface DayRow {
  id: string;
  day_number: number;
  name: string;
  focus: string;
  estimated_minutes: number | null;
  warmup: string[];
  cooldown: string[];
}

interface PeRow {
  id: string;
  day_id: string;
  position: number;
  sets: number;
  reps: string | null;
  duration_seconds: number | null;
  rest_seconds: number;
  intensity: string | null;
  rpe: number | null;
  notes: string | null;
  exercise: { id: string; slug: string; name: string } | null;
}

export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { slug } = await params;
  const { week: weekParam } = await searchParams;
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();

  const { data: programData } = await supabase.from("training_programs").select("*").eq("slug", slug).maybeSingle();
  if (!programData) notFound();
  const program = programData as ProgramRow;

  const [plan, upRes, weeksRes, categoryRes] = await Promise.all([
    getUserPlan(user.id),
    supabase.from("user_programs").select("id, status, current_week, current_day").eq("user_id", user.id).eq("program_id", program.id).maybeSingle(),
    supabase.from("program_weeks").select("id, week_number, focus, is_deload").eq("program_id", program.id).order("week_number"),
    program.category_id ? supabase.from("program_categories").select("name, slug").eq("id", program.category_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const userProgram = upRes.data;
  const weeks = weeksRes.data ?? [];
  const locked = program.owner_id !== user.id && !canAccessTier(plan, program.tier);
  const isActive = userProgram?.status === "active";
  const defaultWeek = isActive ? (userProgram?.current_week as number) : 1;
  const weekNumber = Math.min(Math.max(1, Number(weekParam) || defaultWeek), Math.max(1, weeks.length));
  const week = weeks.find((w) => w.week_number === weekNumber);

  const { data: daysData } = week
    ? await supabase.from("program_days").select("id, day_number, name, focus, estimated_minutes, warmup, cooldown").eq("week_id", week.id).order("day_number")
    : { data: [] };
  const days = (daysData ?? []) as DayRow[];

  // Premium prescriptions are only fetched server-side when the user has access.
  let exercisesByDay = new Map<string, PeRow[]>();
  let alternatives = new Map<string, string[]>();
  if (!locked && days.length) {
    const { data: peData } = await supabase
      .from("program_exercises")
      .select("id, day_id, position, sets, reps, duration_seconds, rest_seconds, intensity, rpe, notes, exercise:exercises(id, slug, name)")
      .in(
        "day_id",
        days.map((d) => d.id),
      )
      .order("position");
    const rows = (peData ?? []) as unknown as PeRow[];
    exercisesByDay = rows.reduce((m, r) => m.set(r.day_id, [...(m.get(r.day_id) ?? []), r]), new Map<string, PeRow[]>());
    const exIds = [...new Set(rows.map((r) => r.exercise?.id).filter(Boolean))] as string[];
    if (exIds.length) {
      const { data: alts } = await supabase.from("exercise_alternatives").select("exercise_id, alt:exercises!exercise_alternatives_alternative_id_fkey(name)").in("exercise_id", exIds);
      alternatives = (alts ?? []).reduce((m, a) => {
        const name = (a.alt as unknown as { name: string } | null)?.name;
        if (name) m.set(a.exercise_id as string, [...(m.get(a.exercise_id as string) ?? []), name]);
        return m;
      }, new Map<string, string[]>());
    }
  }

  const goals = program.goals.filter((g) => !g.startsWith("type:"));

  return (
    <div className="space-y-6">
      <Link href="/train" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Train
      </Link>

      <header className="bg-card-gradient rounded-3xl border border-border p-5 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">
          {(categoryRes.data?.name as string) ?? (program.source === "ai" ? "AI-generated" : "Personal program")}
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none md:text-5xl">{program.name}</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">{program.description || program.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary">{titleCase(program.difficulty)}</Badge>
          <Badge variant="secondary">
            {program.duration_weeks} {program.duration_weeks === 1 ? "week" : "weeks"}
          </Badge>
          <Badge variant="secondary">{program.days_per_week} sessions / week</Badge>
          <Badge variant="secondary">
            <Clock className="size-3" aria-hidden /> ~{program.session_minutes} min
          </Badge>
          {program.low_impact && <Badge variant="success">Low impact</Badge>}
          {goals.map((g) => (
            <Badge key={g} variant="outline">
              {titleCase(g)}
            </Badge>
          ))}
        </div>
        <div className="mt-6">
          <ProgramActions programId={program.id} locked={locked} isActive={isActive} isSaved={Boolean(userProgram)} />
        </div>
      </header>

      {locked && (
        <Notice tone="info">
          <Lock className="mr-1 inline size-4 text-gold" aria-hidden /> You&apos;re viewing the program outline. Upgrade to Plus to see every
          exercise, set, rep and intensity target — and to start the program.
        </Notice>
      )}

      <section className="grid gap-4 md:grid-cols-3" aria-label="Program guidance">
        <div className="rounded-2xl border border-border bg-card p-5 md:col-span-1">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase">
            <TrendingUp className="size-4 text-gold" aria-hidden /> Progression
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{program.progression}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase">
            <Flame className="size-4 text-gold" aria-hidden /> Warm-up
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {program.warmup.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase">
            <Snowflake className="size-4 text-gold" aria-hidden /> Cooldown
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {program.cooldown.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="schedule-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 id="schedule-title" className="font-display text-2xl font-bold uppercase">
            Weekly schedule
          </h2>
          {week && (
            <p className="text-sm text-muted-foreground">
              {week.is_deload && <Badge className="mr-2">Deload</Badge>}
              {week.focus as string}
            </p>
          )}
        </div>
        {weeks.length > 1 && (
          <nav aria-label="Weeks" className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {weeks.map((w) => (
              <Link
                key={w.id as string}
                href={`/train/programs/${program.slug}?week=${w.week_number}`}
                aria-current={w.week_number === weekNumber ? "page" : undefined}
                scroll={false}
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold",
                  w.week_number === weekNumber ? "border-gold bg-gold/10 text-gold-highlight" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="sr-only">Week </span>
                {w.week_number as number}
              </Link>
            ))}
          </nav>
        )}

        <ol className="grid gap-4 lg:grid-cols-2">
          {days.map((d) => {
            const exs = exercisesByDay.get(d.id) ?? [];
            const isNext = isActive && userProgram?.current_week === weekNumber && userProgram?.current_day === d.day_number;
            return (
              <li key={d.id} className={cn("rounded-2xl border bg-card p-5", isNext ? "border-gold-muted" : "border-border")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-gold">
                      Day {d.day_number}
                      {isNext && " · Up next"}
                    </p>
                    <h3 className="font-display text-xl font-bold uppercase">{d.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {d.focus}
                      {d.estimated_minutes ? ` · ~${d.estimated_minutes} min` : ""}
                    </p>
                  </div>
                  {!locked && (
                    <Button asChild size="sm" variant={isNext ? "default" : "secondary"}>
                      <Link href={`/train/workout?day=${d.id}${userProgram ? `&up=${userProgram.id}` : ""}`}>
                        <Play aria-hidden /> Start
                      </Link>
                    </Button>
                  )}
                </div>
                {!locked && (
                  <ol className="mt-4 divide-y divide-border">
                    {exs.map((e) => (
                      <li key={e.id} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <Link href={`/train/exercises/${e.exercise?.slug}`} className="font-semibold hover:text-gold-highlight">
                            {e.exercise?.name}
                          </Link>
                          <span className="shrink-0 font-display text-base font-semibold text-gold-highlight">
                            {e.sets} × {e.reps ?? (e.duration_seconds ? formatDuration(e.duration_seconds) : "")}
                          </span>
                        </div>
                        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            <Repeat className="mr-1 inline size-3" aria-hidden />
                            Rest {e.rest_seconds >= 60 ? `${Math.floor(e.rest_seconds / 60)}:${String(e.rest_seconds % 60).padStart(2, "0")}` : `${e.rest_seconds}s`}
                          </span>
                          {(e.intensity || e.rpe) && <span>{[e.intensity, e.rpe ? `RPE ${e.rpe}` : null].filter(Boolean).join(" · ")}</span>}
                        </p>
                        {e.notes && <p className="mt-1 text-xs text-muted-foreground">{e.notes}</p>}
                        {e.exercise && (alternatives.get(e.exercise.id)?.length ?? 0) > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            <span className="text-foreground/70">Alternatives:</span> {alternatives.get(e.exercise.id)!.slice(0, 3).join(", ")}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
