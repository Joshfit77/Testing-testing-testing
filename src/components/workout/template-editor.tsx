"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Link2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Notice } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useDraft } from "@/lib/use-draft";
import { cn } from "@/lib/utils";
import type { UnitSystem } from "@/lib/domain/types";
import { distanceMode, toMetres, usesDistance } from "@/lib/domain/exercise-tracking";
import { defaultTarget, distanceUnitFor, nextEditorKey as nextKey, normalizeTemplateGroups, REST_OPTIONS, supersetLetter, type EditorExercise, type EditorValue, type TemplateTarget } from "@/lib/domain/workout-templates";
import { createTemplateAction, updateTemplateAction } from "@/server/actions/templates";
import { ExercisePicker, type CatalogItem } from "./exercise-picker";

/**
 * Build or edit a saved workout: pick exercises from the library, set their order, sets, a reps / time /
 * distance target and rest, and join neighbours into supersets. Unsaved work survives tab switches (useDraft).
 */
export function TemplateEditor({ templateId, initial, catalog, units }: { templateId: string | null; initial: EditorValue; catalog: CatalogItem[]; units: UnitSystem }) {
  const router = useRouter();
  const draft = useDraft<EditorValue>(`workout-template:${templateId ?? "new"}`, initial);
  const value = draft.value;
  const set = (fn: (v: EditorValue) => EditorValue) => draft.setValue((v) => fn(v));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const updateEx = (key: string, patch: Partial<EditorExercise>) => set((v) => ({ ...v, exercises: v.exercises.map((e) => (e.key === key ? { ...e, ...patch } : e)) }));
  const regroup = (list: EditorExercise[]) => normalizeTemplateGroups(list);
  const move = (i: number, dir: -1 | 1) =>
    set((v) => {
      const list = [...v.exercises];
      const j = i + dir;
      if (j < 0 || j >= list.length) return v;
      [list[i], list[j]] = [list[j]!, list[i]!];
      // Moving breaks a superset unless both stay neighbours with the same group.
      return { ...v, exercises: regroup(list) };
    });
  const remove = (key: string) => set((v) => ({ ...v, exercises: regroup(v.exercises.filter((e) => e.key !== key)) }));
  const toggleSuperset = (i: number) =>
    set((v) => {
      const list = v.exercises.map((e) => ({ ...e }));
      const a = list[i]!;
      const b = list[i + 1];
      if (!b) return v;
      if (a.supersetGroup != null && a.supersetGroup === b.supersetGroup) {
        // Split the superset between i and i+1: everything after i gets a new group.
        const g = a.supersetGroup;
        const fresh = Math.max(0, ...list.map((e) => e.supersetGroup ?? 0)) + 1;
        for (let k = i + 1; k < list.length && list[k]!.supersetGroup === g; k++) list[k]!.supersetGroup = fresh;
      } else {
        const g = a.supersetGroup ?? b.supersetGroup ?? Math.max(0, ...list.map((e) => e.supersetGroup ?? 0)) + 1;
        const old = b.supersetGroup;
        a.supersetGroup = g;
        for (let k = i + 1; k < list.length && (k === i + 1 || (old != null && list[k]!.supersetGroup === old)); k++) list[k]!.supersetGroup = g;
      }
      return { ...v, exercises: regroup(list) };
    });

  const toInput = () => ({
    name: value.name.trim(),
    notes: value.notes.trim() || null,
    exercises: value.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets,
      target: e.target,
      reps: e.target === "reps" ? e.reps.trim() || null : null,
      durationSeconds: e.target === "time" ? Math.round(Number(e.seconds)) || null : null,
      distanceM: e.target === "distance" ? toMetres(Number(e.distance.replace(",", ".")), distanceUnitFor(e.slug, units)) || null : null,
      restSeconds: e.restSeconds,
      supersetGroup: e.supersetGroup,
      notes: null,
    })),
  });

  const save = () => {
    setError(null);
    if (!value.name.trim()) return setError("Name your workout.");
    if (!value.exercises.length) return setError("Add at least one exercise.");
    const missing = value.exercises.find((e) => (e.target === "reps" && !e.reps.trim()) || (e.target === "time" && !(Number(e.seconds) >= 5)) || (e.target === "distance" && !(Number(e.distance.replace(",", ".")) > 0)));
    if (missing) return setError(`Set the ${missing.target === "reps" ? "reps" : missing.target === "time" ? "time (5 seconds or more)" : "distance"} for ${missing.name}.`);
    start(async () => {
      const input = toInput();
      const res = await (templateId ? updateTemplateAction(templateId, input) : createTemplateAction(input)).catch(() => ({ ok: false as const, error: "You appear to be offline. Your changes are kept on this device." }));
      if (!res.ok) return setError(res.error);
      draft.clear();
      router.push("/train/templates");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {draft.restored && (
        <Notice tone="info">
          Unsaved changes restored.{" "}
          <button type="button" className="font-semibold underline underline-offset-4" onClick={() => draft.clear()}>
            Discard them
          </button>
        </Notice>
      )}
      <div className="space-y-1.5">
        <label htmlFor="tpl-name" className="text-sm font-semibold">
          Workout name
        </label>
        <Input id="tpl-name" value={value.name} onChange={(e) => set((v) => ({ ...v, name: e.target.value }))} maxLength={120} placeholder="e.g. Upper body pump" />
      </div>

      {value.exercises.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="font-semibold">No exercises yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add exercises from the library, then set sets, reps, time or distance, and rest.</p>
        </div>
      ) : (
        <ol className="space-y-2" aria-label="Exercises">
          {value.exercises.map((e, i) => {
            const nextEx = value.exercises[i + 1];
            const linkedNext = Boolean(nextEx && e.supersetGroup != null && nextEx.supersetGroup === e.supersetGroup);
            const dUnit = distanceUnitFor(e.slug, units);
            const canDistance = usesDistance(e.slug);
            return (
              <li key={e.key}>
                <section
                  className={cn("rounded-2xl border border-border bg-card p-3", e.supersetGroup != null && "border-l-4 border-l-gold")}
                  aria-label={`${i + 1}. ${e.name}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {e.supersetGroup != null && <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">Superset {supersetLetter(e.supersetGroup)}</p>}
                      <p className="font-semibold leading-tight">
                        {i + 1}. {e.name}
                      </p>
                    </div>
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${e.name} up`}>
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === value.exercises.length - 1} aria-label={`Move ${e.name} down`}>
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => remove(e.key)} aria-label={`Remove ${e.name}`}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-[4.5rem_1fr] gap-2">
                    <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Sets
                      <NativeSelect value={e.sets} onChange={(ev) => updateEx(e.key, { sets: Number(ev.target.value) })} aria-label={`${e.name} sets`}>
                        {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </NativeSelect>
                    </label>
                    <div className="space-y-1">
                      <div className="grid grid-cols-3 gap-1" role="group" aria-label={`${e.name} target`}>
                        {(["reps", "time", ...(canDistance ? ["distance"] : [])] as TemplateTarget[]).map((t) => (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={e.target === t}
                            onClick={() => updateEx(e.key, { target: t })}
                            className={cn(
                              "min-h-11 rounded-lg border text-xs font-semibold capitalize",
                              e.target === t ? "border-gold bg-gold/10 text-gold-highlight" : "border-border text-muted-foreground",
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {e.target === "reps" ? "Reps" : e.target === "time" ? "Seconds" : `Distance (${dUnit})`}
                      {e.target === "reps" && (
                        <Input value={e.reps} onChange={(ev) => updateEx(e.key, { reps: ev.target.value.slice(0, 20) })} aria-label={`${e.name} reps`} placeholder="e.g. 8-12" />
                      )}
                      {e.target === "time" && (
                        <Input value={e.seconds} inputMode="numeric" onChange={(ev) => updateEx(e.key, { seconds: ev.target.value.replace(/\D/g, "").slice(0, 4) })} aria-label={`${e.name} seconds`} placeholder="Seconds" />
                      )}
                      {e.target === "distance" && (
                        <Input value={e.distance} inputMode="decimal" onChange={(ev) => updateEx(e.key, { distance: ev.target.value.replace(/[^0-9.,]/g, "").slice(0, 7) })} aria-label={`${e.name} distance in ${dUnit}`} placeholder={dUnit} />
                      )}
                    </label>
                    <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Rest
                      <NativeSelect value={e.restSeconds} onChange={(ev) => updateEx(e.key, { restSeconds: Number(ev.target.value) })} aria-label={`${e.name} rest`}>
                        {[...new Set([...REST_OPTIONS, e.restSeconds])].sort((a, b) => a - b).map((r) => (
                          <option key={r} value={r}>
                            {r < 60 ? `${r} s` : `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`}
                          </option>
                        ))}
                      </NativeSelect>
                    </label>
                  </div>
                </section>
                {nextEx && (
                  <button
                    type="button"
                    onClick={() => toggleSuperset(i)}
                    aria-pressed={linkedNext}
                    className={cn("mx-auto my-1 flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold", linkedNext ? "text-gold-highlight" : "text-muted-foreground hover:text-foreground")}
                  >
                    <Link2 className="size-3.5" aria-hidden /> {linkedNext ? `Superset with ${nextEx.name} — tap to split` : `Superset with ${nextEx.name}`}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <Button type="button" variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
        <Plus aria-hidden /> Add exercise
      </Button>

      <div className="space-y-1.5">
        <label htmlFor="tpl-notes" className="text-sm font-semibold">
          Notes (optional)
        </label>
        <Textarea id="tpl-notes" value={value.notes} onChange={(e) => set((v) => ({ ...v, notes: e.target.value.slice(0, 2000) }))} placeholder="Cues, warm-up, equipment settings" />
      </div>
      <p className="text-xs text-muted-foreground">Supersets alternate one set of each exercise, with rest only after the round (the longest rest in the superset).</p>

      {error && <Notice tone="error">{error}</Notice>}
      <Button type="button" className="w-full" onClick={save} disabled={pending} aria-busy={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} {templateId ? "Save changes" : "Save template"}
      </Button>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Add exercise"
        catalog={catalog}
        onPick={(item) =>
          set((v) => ({
            ...v,
            exercises: [
              ...v.exercises,
              {
                key: nextKey(),
                exerciseId: item.id,
                slug: item.slug,
                name: item.name,
                isTimed: item.isTimed,
                sets: 3,
                target: defaultTarget(item),
                reps: "8-12",
                seconds: "30",
                distance: distanceMode(item.slug) === "cardio" ? "1" : usesDistance(item.slug) ? "20" : "",
                restSeconds: item.isTimed ? 45 : 90,
                supersetGroup: null,
              },
            ].slice(0, 40),
          }))
        }
      />
    </div>
  );
}
