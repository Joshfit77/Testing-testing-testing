import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { toggleFlagAction } from "@/server/actions/admin";

export const metadata = { title: "Admin · Feature flags" };

export default async function AdminFlagsPage() {
  await requireAdmin();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("feature_flags").select("*").order("key");
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Feature flags" description="Flags are enforced server-side. Changes take effect immediately." />
      <AdminNav current="/admin/flags" />
      <ul className="space-y-3">
        {(data ?? []).map((f) => (
          <li key={f.key as string} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <div>
              <p className="font-mono text-sm font-semibold">{f.key as string}</p>
              <p className="text-xs text-muted-foreground">{f.description as string}</p>
            </div>
            <form action={toggleFlagAction}>
              <input type="hidden" name="key" value={f.key as string} />
              <input type="hidden" name="enabled" value={f.enabled ? "false" : "true"} />
              <Button type="submit" size="sm" variant={f.enabled ? "default" : "secondary"} aria-label={`${f.key as string} is ${f.enabled ? "on" : "off"}. Toggle`}>
                {f.enabled ? "On" : "Off"}
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
