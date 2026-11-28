import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { DEFAULT_LIMITS } from "@/lib/biblical-ai/config";
import { coachModelIds } from "@/lib/coach/routing";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { markReportReviewedAction, setSourceStatusAction } from "@/server/actions/biblical-ai";
import { biblicalAiFlagOn, biblicalAiLimits } from "@/server/services/biblical-ai";

export const metadata = { title: "Admin · Biblical AI" };

const card = "rounded-2xl border border-border bg-card p-4";
const n = (v: unknown) => Number(v ?? 0).toLocaleString("en-US");

interface Metrics {
  questions: number;
  failed: number;
  active_members: number;
  by_depth: Record<string, number>;
  avg_latency_ms: number | null;
  validation_failures: number;
  daily: { day: string; questions: number }[];
  reports_open: number;
  reports: number;
  cost_micros: number;
}

/**
 * Biblical AI for administrators: aggregate usage (no member, question or answer), the source inventory with its
 * approval status, and inaccuracy reports members chose to send. Conversations themselves are never shown here.
 */
export default async function AdminBiblicalAiPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const supabase = await getServerSupabase();
  const service = getServiceSupabase();
  const [{ data: metricsRaw, error: metricsError }, { data: sources }, { data: reports }, flagOn] = await Promise.all([
    // Through the admin's own session: the database checks the admin role (with two-step sign-in) too.
    supabase.rpc("biblical_ai_admin_metrics", { p_days: days }),
    service.from("biblical_ai_sources").select("slug, kind, name, author, ministry, official_url, licence, commercial_use, storage_permitted, attribution, attribution_required, status, notes, updated_at").order("kind").order("name"),
    service.from("biblical_ai_feedback").select("id, kind, note, question, answer, created_at").eq("kind", "inaccurate").eq("status", "open").order("created_at", { ascending: false }).limit(20),
    biblicalAiFlagOn(),
  ]);
  const m = (metricsRaw as Metrics | null) ?? null;
  const models = coachModelIds(process.env);
  const free = biblicalAiLimits("free");
  const pro = biblicalAiLimits("pro");

  return (
    <div className="space-y-4">
      <AdminNav current="/admin/biblical-ai" />
      <PageHeader title="Biblical AI" description={`Flag biblical_ai is ${flagOn ? "ON" : "OFF"} (Admin → Flags). Aggregates only; conversations are private to members.`} />
      <nav className="flex gap-2 text-sm" aria-label="Period">
        {[7, 30, 90].map((d) => (
          <a key={d} href={`/admin/biblical-ai?days=${d}`} aria-current={d === days ? "page" : undefined} className={`rounded-full border px-3 py-1 ${d === days ? "border-gold text-gold-highlight" : "border-border"}`}>
            {d} days
          </a>
        ))}
      </nav>
      {metricsError || !m ? (
        <p className={card}>Metrics are unavailable.</p>
      ) : (
        <section className="grid gap-2 sm:grid-cols-4" aria-label="Usage">
          {[
            ["Questions answered", n(m.questions)],
            ["Active members", n(m.active_members)],
            ["Failed requests", n(m.failed)],
            ["Avg. response", m.avg_latency_ms ? `${(m.avg_latency_ms / 1000).toFixed(1)} s` : "—"],
            ["Citation-check failures", n(m.validation_failures)],
            ["Open inaccuracy reports", n(m.reports_open)],
            ["AI cost (Bible features)", `$${(Number(m.cost_micros) / 1_000_000).toFixed(2)}`],
            ["By depth", Object.entries(m.by_depth).map(([k, v]) => `${k} ${v}`).join(", ") || "—"],
          ].map(([label, value]) => (
            <div key={label} className={card}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold">{value}</p>
            </div>
          ))}
        </section>
      )}

      <section className={card} aria-labelledby="config-title">
        <h2 id="config-title" className="font-semibold">
          Configuration
        </h2>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>
            Models: quick and standard on {models.fast}; deep studies (Pro) on {models.smart}, falling back to {models.fast} when budgets are tight.
          </li>
          <li>
            Free: {free.daily}/day, {free.monthly}/month (defaults {DEFAULT_LIMITS.free.daily}/{DEFAULT_LIMITS.free.monthly}). Pro: {pro.daily}/day, {pro.monthly}/month. Override with BIBLICAL_AI_FREE_DAILY, BIBLICAL_AI_PRO_MONTHLY and similar.
          </li>
          <li>The member and global AI budgets, daily limit and in-flight limits on the AI costs page apply to Biblical AI too.</li>
        </ul>
      </section>

      <section className={card} aria-labelledby="sources-title">
        <h2 id="sources-title" className="font-semibold">
          Sources
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Only approved sources are used. Teachers are internal knowledge sources: members never see this list, teacher names or profiles; their approved material informs one assistant&apos;s answers, and a credit is shown only where a licence requires it. Approving a teacher&apos;s material needs a founder (FOUNDER_USER_IDS) and confirmed rights; any administrator can disable a source. Every change is recorded.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Rights</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Change</th>
              </tr>
            </thead>
            <tbody>
              {(sources ?? []).map((s) => (
                <tr key={s.slug as string} className="border-t border-border align-top">
                  <td className="py-2 pr-3">
                    <p className="font-semibold">{s.name as string}</p>
                    <p className="text-xs text-muted-foreground">
                      {[s.kind, s.ministry, s.official_url].filter(Boolean).join(" · ")}
                    </p>
                    {s.notes && <p className="text-xs text-muted-foreground">{s.notes as string}</p>}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {(s.licence as string | null) ?? "Not verified"}
                    <br />
                    Commercial use: {s.commercial_use as string}; storage: {s.storage_permitted as string}
                    <br />
                    Credit shown to members: {s.attribution_required ? ((s.attribution as string | null) ?? "required, text missing") : "none"}
                  </td>
                  <td className="py-2 pr-3 font-semibold">{(s.status as string).replace("_", " ")}</td>
                  <td className="py-2">
                    <form action={setSourceStatusAction} className="flex flex-wrap items-center gap-1">
                      <input type="hidden" name="slug" value={s.slug as string} />
                      <select name="status" defaultValue={s.status as string} className="h-9 rounded-lg border border-border bg-background px-2 text-xs" aria-label={`Status for ${s.name}`}>
                        <option value="pending_review">Pending review</option>
                        <option value="approved">Approved</option>
                        <option value="disabled">Disabled</option>
                      </select>
                      <input name="reason" required minLength={3} maxLength={1000} placeholder="Reason" className="h-9 w-32 rounded-lg border border-border bg-background px-2 text-xs" aria-label={`Reason for ${s.name}`} />
                      <Button type="submit" size="sm" variant="secondary">
                        Save
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={card} aria-labelledby="reports-title">
        <h2 id="reports-title" className="font-semibold">
          Open inaccuracy reports
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">The member chose to send this question and answer for review. Don&apos;t copy them anywhere else.</p>
        {!reports?.length ? (
          <p className="mt-2 text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {reports.map((r) => (
              <li key={r.id as string} className="space-y-1 rounded-xl border border-border p-3 text-sm">
                <p className="text-xs text-muted-foreground">{new Date(r.created_at as string).toLocaleString()}</p>
                {r.note && <p><span className="font-semibold">Note: </span>{r.note as string}</p>}
                {r.question && <p><span className="font-semibold">Question: </span>{r.question as string}</p>}
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-gold-highlight">Answer</summary>
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">{r.answer as string}</p>
                </details>
                <form action={markReportReviewedAction}>
                  <input type="hidden" name="id" value={r.id as string} />
                  <Button type="submit" size="sm" variant="secondary">
                    Mark reviewed
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
