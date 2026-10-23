import { PageHeader } from "@/components/common/page-header";
import { PlanLocked } from "@/components/common/plan-locked";
import { BackLink } from "@/components/platform/back-link";
import { BodyScanConsentCard } from "@/components/body-scan/consent-card";
import { BodyScanDashboard } from "@/components/body-scan/scan-dashboard";
import { canUseBodyScan } from "@/lib/domain/body-scan";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { listBodyScans, loadBodyTrends } from "@/server/services/body-scan";

export const metadata = { title: "Body Scan" };

const DESCRIPTION = "Guided front, side and rear photos taken the same way each time, with your weight and tape measurements, so you can compare scans side by side.";

export default async function BodyScanPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [plan, { saved }, consentRow] = await Promise.all([
    getUserPlan(user.id),
    searchParams,
    supabase.from("profiles").select("body_scan_consent_at").eq("id", user.id).maybeSingle(),
  ]);
  const units = profile.unit_system ?? "imperial";

  if (!canUseBodyScan(plan)) {
    // Scans kept from an earlier Pro membership stay viewable and deletable.
    const scans = await listBodyScans(supabase, user.id);
    if (!scans.length) {
      return <PlanLocked back={{ href: "/progress", label: "My Progress" }} eyebrow="My Progress" title="Body Scan" plan="Pro" description={DESCRIPTION} />;
    }
    const trends = await loadBodyTrends(supabase, user.id, addDays(isoDateInTz(new Date(), profile.timezone), -365));
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <BackLink href="/progress">My Progress</BackLink>
        <PageHeader eyebrow="My Progress" title="Body Scan" description="New scans are included with Pro. Your saved scans stay here for you to view, export or delete." />
        <BodyScanDashboard scans={scans} trends={trends} units={units} savedId={null} canScan={false} />
      </div>
    );
  }

  if (!consentRow.data?.body_scan_consent_at) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <BackLink href="/progress">My Progress</BackLink>
        <PageHeader eyebrow="My Progress" title="Body Scan" description={DESCRIPTION} />
        <BodyScanConsentCard />
      </div>
    );
  }

  const [scans, trends] = await Promise.all([listBodyScans(supabase, user.id), loadBodyTrends(supabase, user.id, addDays(isoDateInTz(new Date(), profile.timezone), -365))]);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <BackLink href="/progress">My Progress</BackLink>
      <PageHeader eyebrow="My Progress" title="Body Scan" description={DESCRIPTION} />
      <BodyScanDashboard scans={scans} trends={trends} units={units} savedId={saved ?? null} canScan />
    </div>
  );
}
