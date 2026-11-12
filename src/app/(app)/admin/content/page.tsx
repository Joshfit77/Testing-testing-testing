import { Trash2 } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/common/page-header";
import { ActionButton } from "@/components/common/action-button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { deleteContentAction, saveContentAction } from "@/server/actions/admin";

export const metadata = { title: "Admin · Content" };

type Item = { id: string; kind: string; title: string; body: string; scripture_ref: string | null; is_published: boolean };

function Fields({ c }: { c?: Item }) {
  return (
    <>
      <div className="grid gap-2 md:grid-cols-[10rem_1fr_12rem]">
        <NativeSelect name="kind" defaultValue={c?.kind ?? "tip"} aria-label="Kind">
          <option value="tip">Tip</option>
          <option value="announcement">Announcement</option>
          <option value="devotional">Devotional (Faith section only)</option>
        </NativeSelect>
        <Input name="title" defaultValue={c?.title} placeholder="Title" aria-label="Title" required />
        <Input name="scriptureRef" defaultValue={c?.scripture_ref ?? ""} placeholder="Scripture ref (optional)" aria-label="Scripture reference" />
      </div>
      <Textarea name="body" defaultValue={c?.body} placeholder="Body" aria-label="Body" required className="min-h-24" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked={c?.is_published ?? false} className="size-5 accent-[#C9A54C]" /> Published
      </label>
    </>
  );
}

export default async function AdminContentPage() {
  await requireAdmin();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("content_items").select("*").order("created_at", { ascending: false });
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Public content" description="Tips, announcements and devotionals. Quote scripture only from public-domain or properly licensed translations." />
      <AdminNav current="/admin/content" />
      <section className="mb-6 rounded-2xl border border-gold-muted/50 bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">New content</h2>
        <ActionForm action={saveContentAction} submitLabel="Create" resetOnSuccess>
          <Fields />
        </ActionForm>
      </section>
      <ul className="space-y-3">
        {((data ?? []) as Item[]).map((c) => (
          <li key={c.id} className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4">
            <div className="flex-1">
              <ActionForm action={saveContentAction}>
                <input type="hidden" name="id" value={c.id} />
                <Fields c={c} />
              </ActionForm>
            </div>
            <ActionButton action={deleteContentAction} fields={{ id: c.id }} variant="ghost" size="icon-sm" aria-label={`Delete ${c.title}`} confirmMessage={`Delete “${c.title}”?`} confirmLabel="Delete">
<Trash2 aria-hidden />
            </ActionButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
