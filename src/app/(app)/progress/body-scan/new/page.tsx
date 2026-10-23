import { redirect } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { ScanCapture } from "@/components/body-scan/scan-capture";
import { canUseBodyScan } from "@/lib/domain/body-scan";
import { displayWeight } from "@/lib/domain/units";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { listBodyScans } from "@/server/services/body-scan";

export const metadata = { title: "New body scan" };

export default async function NewBodyScanPage() {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [plan, consent] = await Promise.all([getUserPlan(user.id), supabase.from("profiles").select("body_scan_consent_at").eq("id", user.id).maybeSingle()]);
  if (!canUseBodyScan(plan) || !consent.data?.body_scan_consent_at) redirect("/progress/body-scan");
  const units = profile.unit_system ?? "imperial";
  const [scans, weight] = await Promise.all([
    listBodyScans(supabase, user.id, 1),
    supabase.from("weight_entries").select("weight_kg").eq("user_id", user.id).order("recorded_on", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <BackLink href="/progress/body-scan">Body Scan</BackLink>
      <PageHeader eyebrow="Body Scan" title="New scan" description="Front and side photos are needed; the rear photo and measurements are optional. Nothing is saved until you tap Save scan." />
      <ScanCapture userId={user.id} units={units} previous={scans[0]?.photos ?? {}} lastWeight={weight.data ? displayWeight(Number(weight.data.weight_kg), units) : null} />
    </div>
  );
}
