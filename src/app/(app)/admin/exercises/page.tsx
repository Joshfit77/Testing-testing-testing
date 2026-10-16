import Link from "next/link";
import { Trash2 } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/common/page-header";
import { ActionButton } from "@/components/common/action-button";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOVEMENT_PATTERNS } from "@/lib/domain/types";
import type { ExerciseRow } from "@/lib/types/db";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth";
import { addExerciseMediaAction, deleteExerciseMediaAction, saveExerciseAction } from "@/server/actions/admin";

export const metadata = { title: "Admin · Exercises" };

export default async function AdminExercisesPage({ searchParams }: { searchParams: Promise<{ id?: string; q?: string }> }) {
  const sp = await searchParams;
  await requireAdmin();
  const supabase = await getServerSupabase();
  let q = supabase.from("exercises").select("id, slug, name, category, is_published").order("name");
  if (sp.q) q = q.ilike("name", `%${sp.q.replace(/[%_]/g, "").slice(0, 60)}%`);
  const { data: list } = await q;
  const { data: selectedData } = sp.id ? await supabase.from("exercises").select("*").eq("id", sp.id).maybeSingle() : { data: null };
  const ex = selectedData as ExerciseRow | null;
  const { data: media } = ex ? await supabase.from("exercise_media").select("*").eq("exercise_id", ex.id) : { data: [] };

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Exercises" />
      <AdminNav current="/admin/exercises" />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="rounded-2xl border border-border bg-card p-4">
          <form className="mb-3 flex gap-2">
            <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search" aria-label="Search exercises" className="h-9" />
            <Button size="sm" variant="secondary" type="submit">
              Go
            </Button>
          </form>
          <Button asChild size="sm" className="mb-3 w-full">
            <Link href="/admin/exercises">+ New exercise</Link>
          </Button>
          <ul className="max-h-[70dvh] space-y-1 overflow-y-auto text-sm">
            {(list ?? []).map((e) => (
              <li key={e.id as string}>
                <Link href={`/admin/exercises?id=${e.id}`} className={`block rounded-lg px-2 py-1.5 hover:bg-elevated ${e.id === sp.id ? "bg-gold/10 text-gold-highlight" : ""}`}>
                  {e.name as string} {!e.is_published && <span className="text-xs text-muted-foreground">(draft)</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 font-display text-lg font-semibold uppercase">{ex ? `Edit ${ex.name}` : "New exercise"}</h2>
            <ActionForm action={saveExerciseAction} key={ex?.id ?? "new"}>
              {ex && <input type="hidden" name="id" value={ex.id} />}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" defaultValue={ex?.name} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="slug">Slug</Label>
                  <Input id="slug" name="slug" defaultValue={ex?.slug} required pattern="[a-z0-9-]+" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="category">Category</Label>
                  <NativeSelect id="category" name="category" defaultValue={ex?.category ?? "strength"}>
                    {["strength", "conditioning", "mobility", "plyometric", "cardio", "core"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="movementPattern">Movement pattern</Label>
                  <NativeSelect id="movementPattern" name="movementPattern" defaultValue={ex?.movement_pattern ?? "other"}>
                    {MOVEMENT_PATTERNS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <NativeSelect id="difficulty" name="difficulty" defaultValue={ex?.difficulty ?? "beginner"}>
                    {["beginner", "intermediate", "advanced"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="equipment">Equipment (comma separated)</Label>
                  <Input id="equipment" name="equipment" defaultValue={ex?.equipment.join(", ")} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="primaryMuscles">Primary muscles (comma separated)</Label>
                <Input id="primaryMuscles" name="primaryMuscles" defaultValue={ex?.primary_muscles.join(", ")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" defaultValue={ex?.description} />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="instructions">Instructions (one per line)</Label>
                  <Textarea id="instructions" name="instructions" defaultValue={ex?.instructions.join("\n")} className="min-h-40" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="formCues">Form cues (one per line)</Label>
                  <Textarea id="formCues" name="formCues" defaultValue={ex?.form_cues.join("\n")} className="min-h-40" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="commonMistakes">Common mistakes (one per line)</Label>
                  <Textarea id="commonMistakes" name="commonMistakes" defaultValue={ex?.common_mistakes.join("\n")} className="min-h-40" />
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="isPublished" defaultChecked={ex?.is_published ?? false} className="size-5 accent-[#C9A54C]" /> Published
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="isTimed" defaultChecked={ex?.is_timed ?? false} className="size-5 accent-[#C9A54C]" /> Timed exercise
                </label>
              </div>
            </ActionForm>
          </section>
          {ex && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-1 font-display text-lg font-semibold uppercase">Demonstration media</h2>
              <p className="mb-4 text-xs text-muted-foreground">Only add media you own or are licensed to use. The license is shown to users.</p>
              <ul className="mb-4 space-y-2 text-sm">
                {(media ?? []).map((m) => (
                  <li key={m.id as string} className="flex items-center justify-between gap-2 rounded-lg bg-elevated/60 px-3 py-2">
                    <span className="truncate">
                      {m.media_type as string}: {(m.external_url as string) ?? (m.storage_path as string)} · {m.license as string}
                    </span>
                    <ActionButton action={deleteExerciseMediaAction} fields={{ id: m.id as string }} size="icon-sm" variant="ghost" aria-label="Delete media">
<Trash2 aria-hidden />
                    </ActionButton>
                  </li>
                ))}
              </ul>
              <ActionForm action={addExerciseMediaAction} submitLabel="Add media" resetOnSuccess>
                <input type="hidden" name="exerciseId" value={ex.id} />
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="mediaType">Type</Label>
                    <NativeSelect id="mediaType" name="mediaType">
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                    </NativeSelect>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="externalUrl">HTTPS URL</Label>
                    <Input id="externalUrl" name="externalUrl" type="url" required placeholder="https://" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="license">License</Label>
                    <Input id="license" name="license" required placeholder="e.g. Owned / CC BY 4.0" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="attribution">Attribution</Label>
                    <Input id="attribution" name="attribution" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="altText">Alt text</Label>
                  <Input id="altText" name="altText" required />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="confirm" className="size-5 accent-[#C9A54C]" /> I confirm we have the right to use this media.
                </label>
              </ActionForm>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
