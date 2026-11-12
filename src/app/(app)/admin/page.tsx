import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { AdminNav } from "@/components/admin/admin-nav";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await getServerSupabase();
  const [metricsRes, activationRes, logsRes, counts] = await Promise.all([
    supabase.rpc("admin_usage_metrics"),
    // New members in the last 30 days (migration 051).
    supabase.rpc("admin_activation_metrics", { p_from: new Date(Date.now() - 30 * 86_400_000).toISOString() }),
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
      <ActivationSummary data={activationRes.error ? null : (activationRes.data as Activation | null)} />
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

interface Activation {
  excluded_test_accounts?: number;
  new_members: { accounts: number; onboarded: number; started_first_workout: number; completed_first_set: number; completed_first_workout: number };
  median_minutes: Record<"signup_to_onboarded" | "onboarded_to_first_workout_start" | "first_workout_start_to_first_set" | "signup_to_first_set" | "signup_to_first_workout_completed", number | null>;
  return_activity: Record<"day1" | "day7" | "day14" | "days1to7", { eligible: number; returned: number }>;
  abandonment: { workouts_started: number; discarded: number; left_in_progress_24h: number; first_workout_abandoned: number };
  returning_members: { trained_in_window: number; workouts_completed: number };
}

const minutes = (m: number | null) => (m == null ? "—" : m < 120 ? `${m} min` : `${(m / 60).toFixed(1)} h`);
const share = (n: number, d: number) => (d ? `${n} of ${d} (${Math.round((n / d) * 100)}%)` : "no one eligible yet");

/** First-workout activation for accounts created in the last 30 days, from server-recorded workout events. */
function ActivationSummary({ data }: { data: Activation | null }) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5" aria-labelledby="activation-title">
      <h2 id="activation-title" className="font-display text-lg font-semibold uppercase">
        First-workout activation (new accounts, last 30 days)
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        From workouts the server stored (start, first completed set, finish, discard), once per workout. Medians. Sandbox testers, admins, demo
        accounts and test addresses (such as @example.com) are left out. Deleted accounts drop out of the counts. With only a few new accounts these
        numbers describe individuals, so treat them as private.
      </p>
      {!data ? (
        <Notice tone="error" className="mt-3">Couldn&apos;t load activation metrics.</Notice>
      ) : (
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ["New accounts", String(data.new_members.accounts)],
            ["Test, tester and admin accounts left out", String(data.excluded_test_accounts ?? 0)],
            ["Finished onboarding", share(data.new_members.onboarded, data.new_members.accounts)],
            ["Started a first workout", share(data.new_members.started_first_workout, data.new_members.accounts)],
            ["Completed a first set", share(data.new_members.completed_first_set, data.new_members.accounts)],
            ["Completed a first workout", share(data.new_members.completed_first_workout, data.new_members.accounts)],
            ["Sign-up → onboarding done", minutes(data.median_minutes.signup_to_onboarded)],
            ["Onboarding → first workout started", minutes(data.median_minutes.onboarded_to_first_workout_start)],
            ["First workout started → first set", minutes(data.median_minutes.first_workout_start_to_first_set)],
            ["Sign-up → first set", minutes(data.median_minutes.signup_to_first_set)],
            ["Sign-up → first workout completed", minutes(data.median_minutes.signup_to_first_workout_completed)],
            ["Trained on day 1", share(data.return_activity.day1.returned, data.return_activity.day1.eligible)],
            ["Trained on day 7", share(data.return_activity.day7.returned, data.return_activity.day7.eligible)],
            ["Trained on day 14", share(data.return_activity.day14.returned, data.return_activity.day14.eligible)],
            ["Trained on days 1–7", share(data.return_activity.days1to7.returned, data.return_activity.days1to7.eligible)],
            ["Workouts started / discarded / left 24 h+", `${data.abandonment.workouts_started} / ${data.abandonment.discarded} / ${data.abandonment.left_in_progress_24h}`],
            ["First workout abandoned", share(data.abandonment.first_workout_abandoned, data.new_members.started_first_workout)],
            ["Returning members who trained", `${data.returning_members.trained_in_window} (${data.returning_members.workouts_completed} workouts)`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-border/60 py-1">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
