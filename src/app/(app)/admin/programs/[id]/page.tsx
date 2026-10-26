import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/common/page-header";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { saveProgramAction, saveProgramExerciseAction } from "@/server/actions/admin";

export const metadata = { title: "Admin · Edit program" };

export default async function AdminProgramEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ week?: string }> }) {
  const { id } = await params;
  const { week } = await searchParams;
  await requireAdmin();
  const supabase = await getServerSupabase();
  const { data: p } = await supabase.from("training_programs").select("*").eq("id", id).is("owner_id", null).maybeSingle();
  if (!p) notFound();
  const weekNumber = Number(week) || 1;
  const [{ data: cats }, { data: w }] = await Promise.all([
    supabase.from("program_categories").select("id, name").order("sort_order"),
    supabase.from("program_weeks").select("id").eq("program_id", id).eq("week_number", weekNumber).maybeSingle(),
  ]);
  const { data: days } = w
    ? await supabase
        .from("program_days")
        .select("id, day_number, name, program_exercises(id, position, sets, reps, duration_seconds, rest_seconds, rpe, notes, exercise:exercises(name))")
        .eq("week_id", w.id)
        .order("day_number")
    : { data: [] };

  return (
    <div>
      <PageHeader eyebrow="Admin" title={p.name as string} />
      <AdminNav current="/admin/programs" />
      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <ActionForm action={saveProgramAction}>
          <input type="hidden" name="id" value={id} />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={p.name as string} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tier">Tier</Label>
              <NativeSelect id="tier" name="tier" defaultValue={p.tier as string}>
                <option value="free">Free</option>
                <option value="plus">Paid library (Pro; legacy Plus)</option>
                <option value="pro">Pro</option>
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="categoryId">Category</Label>
            <NativeSelect id="categoryId" name="categoryId" defaultValue={(p.category_id as string) ?? ""}>
              <option value="">None</option>
              {(cats ?? []).map((c) => (
                <option key={c.id as string} value={c.id as string}>
                  {c.name as string}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="summary">Summary</Label>
            <Input id="summary" name="summary" defaultValue={p.summary as string} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={p.description as string} className="min-h-32" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPublished" defaultChecked={p.is_published as boolean} className="size-5 accent-[#C9A54C]" /> Published
          </label>
        </ActionForm>
      </section>

      <h2 className="mb-2 font-display text-xl font-bold uppercase">Prescriptions · week {weekNumber}</h2>
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Weeks">
        {Array.from({ length: p.duration_weeks as number }, (_, i) => i + 1).map((n) => (
          <a key={n} href={`/admin/programs/${id}?week=${n}`} className={n === weekNumber ? "rounded-lg border border-gold px-3 py-1 text-sm text-gold-highlight" : "rounded-lg border border-border px-3 py-1 text-sm text-muted-foreground"}>
            {n}
          </a>
        ))}
      </nav>
      <div className="space-y-4">
        {(days ?? []).map((d) => (
          <section key={d.id as string} className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 font-semibold">
              Day {d.day_number as number}: {d.name as string}
            </h3>
            <ul className="space-y-3">
              {((d.program_exercises as unknown as { id: string; position: number; sets: number; reps: string | null; duration_seconds: number | null; rest_seconds: number; rpe: number | null; notes: string | null; exercise: { name: string } }[]) ?? [])
                .sort((a, b) => a.position - b.position)
                .map((e) => (
                  <li key={e.id} className="rounded-xl bg-elevated/50 p-3">
                    <p className="mb-2 text-sm font-semibold">{e.exercise.name}</p>
                    <ActionForm action={saveProgramExerciseAction} className="grid grid-cols-2 items-end gap-2 md:grid-cols-7">
                      <input type="hidden" name="id" value={e.id} />
                      <label className="text-xs">
                        Sets
                        <Input name="sets" type="number" defaultValue={e.sets} className="h-9" />
                      </label>
                      <label className="text-xs">
                        Reps
                        <Input name="reps" defaultValue={e.reps ?? ""} className="h-9" />
                      </label>
                      <label className="text-xs">
                        Seconds
                        <Input name="durationSeconds" type="number" defaultValue={e.duration_seconds ?? ""} className="h-9" />
                      </label>
                      <label className="text-xs">
                        Rest (s)
                        <Input name="restSeconds" type="number" defaultValue={e.rest_seconds} className="h-9" />
                      </label>
                      <label className="text-xs">
                        RPE
                        <Input name="rpe" type="number" step="0.5" defaultValue={e.rpe ?? ""} className="h-9" />
                      </label>
                      <label className="col-span-2 text-xs">
                        Notes
                        <Input name="notes" defaultValue={e.notes ?? ""} className="h-9" />
                      </label>
                    </ActionForm>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
