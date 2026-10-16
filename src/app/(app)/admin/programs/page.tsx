import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "Admin · Programs" };

export default async function AdminProgramsPage() {
  await requireAdmin();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("training_programs").select("id, name, tier, is_published, duration_weeks, days_per_week").is("owner_id", null).order("name");
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Programs" description="Curated library programs. Personal and AI-generated programs are private to their owners and not listed." />
      <AdminNav current="/admin/programs" />
      <ul className="grid gap-3 md:grid-cols-2">
        {(data ?? []).map((p) => (
          <li key={p.id as string}>
            <Link href={`/admin/programs/${p.id}`} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:border-gold-muted">
              <span>
                <span className="block font-semibold">{p.name as string}</span>
                <span className="text-xs text-muted-foreground">
                  {p.duration_weeks as number} weeks · {p.days_per_week as number} days
                </span>
              </span>
              <span className="flex gap-1">
                <Badge variant="secondary">{p.tier as string}</Badge>
                {!p.is_published && <Badge variant="outline">draft</Badge>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
