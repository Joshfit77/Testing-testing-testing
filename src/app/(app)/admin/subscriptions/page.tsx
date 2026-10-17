import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { getServiceSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { isServiceRoleConfigured } from "@/server/env";

export const metadata = { title: "Admin · Subscriptions" };

/** Billing status only — no health, nutrition, journal or AI data is read here. */
export default async function AdminSubscriptionsPage() {
  await requireAdmin();
  if (!isServiceRoleConfigured()) {
    return (
      <div>
        <PageHeader eyebrow="Admin" title="Subscriptions" />
        <AdminNav current="/admin/subscriptions" />
        <Notice tone="warning">SUPABASE_SERVICE_ROLE_KEY is required to view subscriptions.</Notice>
      </div>
    );
  }
  const admin = getServiceSupabase();
  const { data: subs } = await admin
    .from("subscriptions")
    .select("id, user_id, plan, status, current_period_end, cancel_at_period_end, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  const ids = [...new Set((subs ?? []).map((s) => s.user_id as string))];
  const { data: profiles } = ids.length ? await admin.from("profiles").select("id, display_name").in("id", ids) : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.display_name as string) ?? "—"]));
  const counts = (subs ?? []).reduce<Record<string, number>>((m, s) => ({ ...m, [s.status as string]: (m[s.status as string] ?? 0) + 1 }), {});

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Subscriptions" description="Most recent 200 subscriptions. Manage refunds and disputes in the Stripe dashboard." />
      <AdminNav current="/admin/subscriptions" />
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(counts).map(([k, v]) => (
          <Badge key={k} variant="secondary">
            {k}: {v}
          </Badge>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-elevated text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Period end</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {(subs ?? []).map((s) => (
              <tr key={s.id as string} className="border-t border-border">
                <td className="px-4 py-2">{names.get(s.user_id as string) ?? "—"}</td>
                <td className="px-4 py-2 capitalize">{s.plan as string}</td>
                <td className="px-4 py-2">
                  {s.status as string}
                  {s.cancel_at_period_end ? " (canceling)" : ""}
                </td>
                <td className="px-4 py-2">{s.current_period_end ? new Date(s.current_period_end as string).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{new Date(s.updated_at as string).toLocaleString()}</td>
              </tr>
            ))}
            {(subs ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No subscriptions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
