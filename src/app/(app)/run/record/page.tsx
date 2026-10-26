import { BackLink } from "@/components/platform/back-link";
import { PageHeader } from "@/components/common/page-header";
import { GpsRecorder, type GuidedSession } from "@/components/run/gps-recorder";
import { isRunDay, type RunPrescription } from "@/lib/domain/run-session";
import { getServerSupabase } from "@/lib/supabase/server";
import { hasFeature } from "@/lib/domain/plans";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { DemoNote } from "@/components/demo/demo-note";

export const metadata = { title: "Record" };

/** A running day of the member's own active program, as a guided session (or null when it isn't one). */
async function loadGuided(supabase: Awaited<ReturnType<typeof getServerSupabase>>, userId: string, userProgramId: string, dayId: string): Promise<GuidedSession | null> {
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(userProgramId) || !uuid.test(dayId)) return null;
  const { data: up } = await supabase.from("user_programs").select("id, program:training_programs(id, name)").eq("id", userProgramId).eq("user_id", userId).maybeSingle();
  const program = up?.program as unknown as { id: string; name: string } | null;
  if (!up || !program) return null;
  const { data: day } = await supabase.from("program_days").select("id, name, week:program_weeks!inner(program_id)").eq("id", dayId).maybeSingle();
  if (!day || (day.week as unknown as { program_id: string }).program_id !== program.id) return null;
  const { data: rows } = await supabase
    .from("program_exercises")
    .select("exercise_id, sets, duration_seconds, rest_seconds, position, exercise:exercises(slug, name)")
    .eq("day_id", dayId)
    .order("position");
  const prescriptions: RunPrescription[] = ((rows ?? []) as unknown as { exercise_id: string; sets: number; duration_seconds: number | null; rest_seconds: number; exercise: { slug: string; name: string } | null }[]).map((r) => ({
    exerciseId: r.exercise_id,
    slug: r.exercise?.slug ?? "",
    name: r.exercise?.name ?? "Exercise",
    sets: r.sets,
    seconds: r.duration_seconds,
    rest: r.rest_seconds,
  }));
  if (!isRunDay(prescriptions)) return null;
  return { userProgramId: up.id as string, programDayId: day.id as string, dayName: day.name as string, programName: program.name, prescriptions };
}

export default async function RecordPage({ searchParams }: { searchParams: Promise<{ kind?: string; day?: string; up?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [guided, plan] = await Promise.all([sp.day && sp.up ? loadGuided(supabase, user.id, sp.up, sp.day) : null, getUserPlan(user.id)]);
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <BackLink href="/run">Run</BackLink>
      <PageHeader eyebrow="Run" title={guided ? "Guided run" : "Record outdoors"} description="Distance, pace, splits and your route from your phone's GPS." />
      <DemoNote topic="gps" />
      <GpsRecorder userId={user.id} units={profile.unit_system} initialKind={sp.kind === "walk" ? "walk" : "run"} guided={guided} canRecord={hasFeature(plan, "live_gps")} />
    </div>
  );
}
