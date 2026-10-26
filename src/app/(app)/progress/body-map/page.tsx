import { PageHeader } from "@/components/common/page-header";
import { PlanLocked } from "@/components/common/plan-locked";
import { BackLink } from "@/components/platform/back-link";
import { MuscleMap } from "@/components/progress/muscle-map";
import { BODY_REGIONS, type BodyRegion } from "@/lib/domain/body-regions";
import { hasFeature } from "@/lib/domain/plans";
import { RULES_VERSION } from "@/lib/domain/strength-ranks";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { loadBodyMap } from "@/server/services/body-map";

export const metadata = { title: "Strength & Body Map" };

export default async function BodyMapPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const { user } = await requireOnboardedUser();
  if (!hasFeature(await getUserPlan(user.id), "advanced_analytics")) {
    return (
      <PlanLocked
        back={{ href: "/progress", label: "My Progress" }}
        eyebrow="My Progress"
        title="Strength & Body Map"
        plan="Pro"
        description="A front-and-back muscle map built from your own workouts: sets, volume, frequency, records and strength trends for each muscle group, with Bronze-to-Disciple strength ranks and exactly how each one is scored."
      />
    );
  }
  const [{ region }, data] = await Promise.all([searchParams, loadBodyMap(await getServerSupabase(), user.id)]);
  const initialRegion = BODY_REGIONS.includes(region as BodyRegion) ? (region as BodyRegion) : null;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <BackLink href="/progress">My Progress</BackLink>
      <PageHeader
        eyebrow="My Progress"
        title="Strength & Body Map"
        description={`Tap a muscle group to see its rank, exercises, records and trends. Built from ${data.sessionsCounted} completed workout${data.sessionsCounted === 1 ? "" : "s"} in the last 12 months.`}
      />
      <MuscleMap
        regions={data.regions}
        stats={data.stats}
        overall={data.overall}
        table={data.table}
        bodyweight={data.bodyweight}
        staleBodyweightDate={data.staleBodyweightDate}
        units={data.units}
        rulesVersion={RULES_VERSION}
        initialRegion={initialRegion}
      />
    </div>
  );
}
