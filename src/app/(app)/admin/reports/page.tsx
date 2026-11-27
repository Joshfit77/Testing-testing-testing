import { AdminNav } from "@/components/admin/admin-nav";
import { ActionButton } from "@/components/common/action-button";
import { PageHeader } from "@/components/common/page-header";
import { REPORT_REASONS, isReportReason } from "@/lib/domain/friends";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { resolveUserReportAction } from "@/server/actions/admin";

export const metadata = { title: "Admin · Member reports" };

interface ReportRow {
  id: string;
  reporter_username: string | null;
  reported_id: string;
  reported_username: string | null;
  reason: string;
  details: string | null;
  created_at: string;
  open_reports_against: number;
}

/**
 * Reports members sent about other members (migration 091). Closing a report records the decision; acting on an
 * account (for example removing it) is done in the Supabase dashboard using the member id shown here.
 */
export default async function AdminReportsPage() {
  await requireAdmin();
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("admin_user_reports", { p_status: "open" });
  const reports = (error ? [] : ((data ?? []) as ReportRow[]));
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Member reports" description="Open reports, newest first. Reports are visible to administrators only; the reported member is never told who reported them." />
      <AdminNav current="/admin/reports" />
      {error && <p className="mb-4 text-sm text-destructive-foreground">Couldn&apos;t load reports.</p>}
      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open reports.</p>
      ) : (
        <ul className="space-y-3" data-testid="admin-reports">
          {reports.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="font-semibold">
                {r.reported_username ? `@${r.reported_username}` : "A member without a username"} <span className="font-normal text-muted-foreground">· {isReportReason(r.reason) ? REPORT_REASONS[r.reason] : r.reason}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Reported by {r.reporter_username ? `@${r.reporter_username}` : "a member"} on {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {r.open_reports_against} open report{r.open_reports_against === 1 ? "" : "s"} about this member
              </p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">Member id: {r.reported_id}</p>
              {r.details && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-elevated/50 p-3 text-sm">{r.details}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton action={resolveUserReportAction} fields={{ id: r.id, status: "actioned" }} size="sm" variant="secondary">
                  Mark as acted on
                </ActionButton>
                <ActionButton action={resolveUserReportAction} fields={{ id: r.id, status: "dismissed" }} size="sm" variant="ghost">
                  Dismiss
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
