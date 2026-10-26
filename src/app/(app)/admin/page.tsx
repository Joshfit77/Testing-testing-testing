import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { AdminNav } from "@/components/admin/admin-nav";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await getServerSupabase();
  const [metricsRes, logsRes, counts] = await Promise.all([
    supabase.rpc("admin_usage_metrics"),
    supabase.from("admin_audit_logs").select("id, action, entity_type, entity_id, created_at").order("created_at", { ascending: false }).limit(15),
    Promise.all([
      supabase.from("exercises").select("id", { count: "exact", head: true }),
      supabase.from("training_programs").select("id", { count: "exact", head: true }).is("owner_id", null),
    ]),
  ]);
  const m = (metricsRes.data as Record<string, number>[] | null)?.[0];
  const tiles = m
    ? [
        ["Total users", m.total_users],
        ["Onboarded", m.onboarded_users],
        ["Active users (30d)", m.active_users_30d],
        ["Workouts (7d)", m.workouts_last_7d],
        ["Workouts (30d)", m.workouts_last_30d],
        ["AI requests (30d)", m.ai_requests_30d],
        ["Legacy Plus subscribers", m.plus_subscribers],
        ["Pro subscribers", m.pro_subscribers],
        ["Exercises", counts[0].count ?? 0],
        ["Library programs", counts[1].count ?? 0],
      ]
    : [];
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Admin dashboard" description="Aggregate metrics only. Individual health, nutrition, journal and AI data is never shown here." />
      <AdminNav current="/admin" />
      {metricsRes.error && <Notice tone="error">Couldn&apos;t load metrics.</Notice>}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Usage metrics">
        {tiles.map(([label, value]) => (
          <div key={label as string} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{Number(value).toLocaleString()}</p>
          </div>
        ))}
      </section>
      <section className="mt-6 rounded-2xl border border-border bg-card p-5" aria-labelledby="audit-title">
        <h2 id="audit-title" className="mb-3 font-display text-lg font-semibold uppercase">
          Recent admin activity
        </h2>
        {(logsRes.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No admin changes recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {(logsRes.data ?? []).map((l) => (
              <li key={l.id as string} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="font-semibold">{l.action as string}</span> <span className="text-muted-foreground">{l.entity_type as string}</span>
                </span>
                <span className="text-xs text-muted-foreground">{new Date(l.created_at as string).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
