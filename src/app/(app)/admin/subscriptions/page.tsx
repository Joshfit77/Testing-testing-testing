import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { getServiceSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { isServiceRoleConfigured, serverEnv } from "@/server/env";
import { ActionForm } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addSandboxTesterAction, removeSandboxTesterAction } from "@/server/actions/admin-sandbox-testers";
import { listSandboxTesters } from "@/server/services/sandbox-testers";

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
  const testers = await listSandboxTesters();
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

      <section className="mt-8 rounded-2xl border border-border bg-card p-5" aria-labelledby="sandbox-title">
        <h2 id="sandbox-title" className="font-display text-lg font-semibold uppercase">
          Sandbox testers
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          App Store and Google Play <strong>sandbox</strong> purchases (development builds, TestFlight, App Review) are free. They unlock a plan only for the accounts listed here,
          matched by user id. Production purchases are not affected.
          {serverEnv.revenueCatAllowSandbox && (
            <strong className="text-gold-highlight"> REVENUECAT_ALLOW_SANDBOX=true is set on this server, so every account&apos;s sandbox purchases count and this list is not needed here.</strong>
          )}
        </p>
        <ul className="mt-4 divide-y divide-border text-sm" aria-label="Sandbox testers">
          {testers.map((t) => (
            <li key={t.userId} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="font-semibold">{t.displayName ?? "—"}</span> <span className="text-muted-foreground">· {t.note}</span>
                <span className="block font-mono text-xs text-muted-foreground">{t.userId}</span>
                <span className="block text-xs text-muted-foreground">
                  Added {new Date(t.createdAt).toLocaleDateString()} · {t.expiresAt ? `${t.active ? "until" : "expired"} ${new Date(t.expiresAt).toLocaleDateString()}` : "no end date"}
                </span>
              </span>
              <form action={removeSandboxTesterAction}>
                <input type="hidden" name="userId" value={t.userId} />
                <Button type="submit" size="sm" variant="outline" aria-label={`Remove ${t.displayName ?? t.userId} from sandbox testers`}>
                  Remove
                </Button>
              </form>
            </li>
          ))}
          {testers.length === 0 && <li className="py-3 text-muted-foreground">No sandbox testers. Sandbox purchases unlock nothing.</li>}
        </ul>
        <ActionForm action={addSandboxTesterAction} submitLabel="Add tester" className="mt-4 grid gap-3 sm:grid-cols-3" resetOnSuccess>
          <div className="space-y-1">
            <Label htmlFor="st-account">Account email or user id</Label>
            <Input id="st-account" name="account" required autoComplete="off" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="st-note">Who and why</Label>
            <Input id="st-note" name="note" required maxLength={200} placeholder="App Review demo account" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="st-expires">Ends on (optional)</Label>
            <Input id="st-expires" name="expiresOn" type="date" />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
