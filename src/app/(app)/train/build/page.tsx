import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { ProgramBuilder } from "@/components/train/program-builder";
import { CUSTOM_PROGRAM_TYPES, type CustomProgramType } from "@/lib/domain/custom-programs";
import type { Equipment, ExperienceLevel } from "@/lib/domain/types";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { loadExercises, toCatalog } from "@/server/services/catalog";

export const metadata = { title: "Build my program" };

export default async function BuildProgramPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [{ data: answers }, { data: weight }, exercises] = await Promise.all([
    supabase.from("onboarding_answers").select("experience, days_per_week, session_minutes, equipment").eq("user_id", user.id).maybeSingle(),
    supabase.from("weight_entries").select("weight_kg").eq("user_id", user.id).order("recorded_on", { ascending: false }).limit(1).maybeSingle(),
    loadExercises(supabase),
  ]);
  const initialType = CUSTOM_PROGRAM_TYPES.includes(type as CustomProgramType) ? (type as CustomProgramType) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/train" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Train
      </Link>
      <PageHeader
        eyebrow="Build my program"
        title="Your custom program"
        description="Pick a style, tell us about you and your goal, and we'll build a periodized plan around your numbers, schedule and equipment."
      />
      <ProgramBuilder
        initialType={initialType}
        initial={{
          units: profile.unit_system,
          age: profile.birth_year ? new Date().getUTCFullYear() - profile.birth_year : undefined,
          heightCm: profile.height_cm ? Number(profile.height_cm) : undefined,
          weightKg: weight?.weight_kg ? Number(weight.weight_kg) : undefined,
          experience: (answers?.experience as ExperienceLevel | undefined) ?? undefined,
          daysPerWeek: (answers?.days_per_week as number | undefined) ?? undefined,
          sessionMinutes: (answers?.session_minutes as number | undefined) ?? undefined,
          equipment: (answers?.equipment as Equipment[] | undefined) ?? ["bodyweight", "mat"],
        }}
        catalog={toCatalog(exercises)}
      />
    </div>
  );
}
