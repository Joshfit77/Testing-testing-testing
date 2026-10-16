import { Trash2 } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { deleteCategoryAction, saveCategoryAction } from "@/server/actions/admin";

export const metadata = { title: "Admin · Categories" };

function Fields({ c }: { c?: { slug: string; name: string; description: string; sort_order: number } }) {
  return (
    <div className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_6rem]">
      <Input name="name" defaultValue={c?.name} placeholder="Name" aria-label="Name" required />
      <Input name="slug" defaultValue={c?.slug} placeholder="slug" aria-label="Slug" required pattern="[a-z0-9-]+" />
      <Input name="description" defaultValue={c?.description} placeholder="Description" aria-label="Description" />
      <Input name="sortOrder" type="number" defaultValue={c?.sort_order ?? 100} aria-label="Sort order" />
    </div>
  );
}

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("program_categories").select("*").order("sort_order");
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Program categories" />
      <AdminNav current="/admin/categories" />
      <section className="mb-6 rounded-2xl border border-gold-muted/50 bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Add category</h2>
        <ActionForm action={saveCategoryAction} submitLabel="Add" resetOnSuccess>
          <Fields />
        </ActionForm>
      </section>
      <ul className="space-y-3">
        {(data ?? []).map((c) => (
          <li key={c.id as string} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <ActionForm action={saveCategoryAction}>
                  <input type="hidden" name="id" value={c.id as string} />
                  <Fields c={c as { slug: string; name: string; description: string; sort_order: number }} />
                </ActionForm>
              </div>
              <form action={deleteCategoryAction}>
                <input type="hidden" name="id" value={c.id as string} />
                <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Delete ${c.name as string}`}>
                  <Trash2 aria-hidden />
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
