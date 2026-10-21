"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/common/states";
import type { UnitSystem } from "@/lib/domain/types";
import { formatDuration, formatWeight } from "@/lib/domain/units";
import { formatDistance, usesDistance } from "@/lib/domain/exercise-tracking";
import { createDraft, newId, workoutReducer, type DraftAction, type WorkoutDraft } from "@/lib/domain/workout-draft";
import { deleteWorkoutAction, editWorkoutAction } from "@/server/actions/workouts";
import { ExerciseCard } from "./exercise-card";
import { ExercisePicker, type CatalogItem } from "./exercise-picker";

export interface EditableSession {
  id: string;
  name: string;
  notes: string;
  startedAt: string;
  endedAt: string;
  pausedSeconds: number;
  volumeKg: number;
  exercises: {
    exerciseId: string;
    slug: string;
    name: string;
    isTimed: boolean;
    substitutedFromId: string | null;
    notes: string;
    skipped: boolean;
    skipReason: "pain" | "equipment" | "time" | "other" | null;
    sets: { reps: number | null; weightKg: number | null; durationSeconds: number | null; distanceM: number | null; rpe: number | null; isWarmup: boolean; completed: boolean }[];
  }[];
}

function toDraft(s: EditableSession): WorkoutDraft {
  const d = createDraft({ name: s.name, now: s.startedAt });
  return {
    ...d,
    notes: s.notes,
    exercises: s.exercises.map((e) => ({
      id: newId(),
      exerciseId: e.exerciseId,
      slug: e.slug,
      name: e.name,
      isTimed: e.isTimed,
      usesDistance: usesDistance(e.slug),
      supersetId: null,
      substitutedFromId: e.substitutedFromId,
      substitutedFromName: null,
      notes: e.notes,
      skipped: e.skipped,
      skipReason: e.skipReason,
      restSeconds: 0,
      target: null,
      sets: e.sets.map((x) => ({ id: newId(), ...x })),
    })),
  };
}

export function WorkoutEditor({ session, catalog, units, timezone }: { session: EditableSession; catalog: CatalogItem[]; units: UnitSystem; timezone: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WorkoutDraft>(() => toDraft(session));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [subKey, setSubKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dispatch = (a: DraftAction) => setDraft((d) => workoutReducer(d, a));
  const duration = (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000 - session.pausedSeconds;
  const subTarget = useMemo(() => draft.exercises.find((e) => e.id === subKey) ?? null, [draft, subKey]);

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await editWorkoutAction({
        sessionId: session.id,
        name: draft.name.trim() || "Workout",
        notes: draft.notes,
        exercises: draft.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          substitutedFromId: e.substitutedFromId,
          notes: e.notes,
          skipped: e.skipped,
          skipReason: e.skipReason,
          sets: e.sets.map(({ reps, weightKg, durationSeconds, distanceM, rpe, isWarmup, completed }) => ({ reps, weightKg, durationSeconds, distanceM, rpe, isWarmup, completed })),
        })),
      });
      if (!res.ok) return setError(res.error);
      setEditing(false);
      setMessage("Changes saved. Personal records were recalculated.");
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      const res = await deleteWorkoutAction(session.id);
      if (!res.ok) {
        setError(res.error);
        setConfirmDelete(false);
        return;
      }
      router.push("/train/history");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input value={draft.name} onChange={(e) => dispatch({ type: "rename", name: e.target.value })} aria-label="Workout name" className="font-display text-xl font-bold uppercase" />
          ) : (
            <h1 className="font-display text-3xl font-bold uppercase md:text-4xl">{session.name}</h1>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(session.startedAt).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: timezone })} · {formatDuration(duration)} ·{" "}
            {formatWeight(session.volumeKg, units)} volume
          </p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(toDraft(session));
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={save} disabled={pending} aria-busy={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} Save changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil aria-hidden /> Edit
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete workout">
                <Trash2 aria-hidden />
              </Button>
            </>
          )}
        </div>
      </header>

      {error && <Notice tone="error">{error}</Notice>}
      {message && !editing && <Notice tone="success">{message}</Notice>}

      {editing ? (
        <>
          {draft.exercises.map((e, i) => (
            <ExerciseCard
              key={e.id}
              exercise={e}
              index={i}
              total={draft.exercises.length}
              units={units}
              dispatch={dispatch}
              onSubstitute={() => setSubKey(e.id)}
              onSkip={() => dispatch({ type: "skipExercise", exerciseKey: e.id, reason: "other" })}
            />
          ))}
          <Button variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
            <Plus aria-hidden /> Add exercise
          </Button>
          <Textarea value={draft.notes} onChange={(e) => dispatch({ type: "setNotes", notes: e.target.value })} aria-label="Workout notes" placeholder="Workout notes" />
          <ExercisePicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            title="Add exercise"
            catalog={catalog}
            onPick={(item) => dispatch({ type: "addExercise", exercise: { id: item.id, slug: item.slug, name: item.name, isTimed: item.isTimed }, restSeconds: 0, target: { sets: 1 } })}
          />
          <ExercisePicker
            open={Boolean(subTarget)}
            onOpenChange={(o) => !o && setSubKey(null)}
            title="Substitute exercise"
            catalog={catalog}
            excludeId={subTarget?.exerciseId}
            onPick={(item) => subTarget && dispatch({ type: "substituteExercise", exerciseKey: subTarget.id, replacement: { id: item.id, slug: item.slug, name: item.name, isTimed: item.isTimed } })}
          />
        </>
      ) : (
        <div className="space-y-3">
          {session.exercises.map((e, i) => (
            <section key={i} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold uppercase">{e.name}</h2>
                {e.skipped && <Badge variant="secondary">Skipped{e.skipReason ? ` · ${e.skipReason}` : ""}</Badge>}
              </div>
              {!e.skipped && (
                <ol className="mt-2 space-y-1 text-sm">
                  {e.sets.map((s, j) => (
                    <li key={j} className="flex items-center justify-between rounded-lg bg-elevated/50 px-3 py-1.5">
                      <span className="text-muted-foreground">{s.isWarmup ? "Warm-up" : `Set ${j + 1}`}</span>
                      <span className={s.completed ? "tabular-nums" : "tabular-nums text-muted-foreground line-through"}>
                        {e.isTimed
                          ? [s.weightKg != null && usesDistance(e.slug) ? formatWeight(s.weightKg, units) : null, s.distanceM != null ? formatDistance(s.distanceM, units) : null, formatDuration(s.durationSeconds ?? 0)].filter(Boolean).join(" · ")
                          : `${s.weightKg != null ? formatWeight(s.weightKg, units) : "Bodyweight"} × ${s.reps ?? 0}${s.distanceM != null ? ` · ${formatDistance(s.distanceM, units)}` : ""}`}
                        {s.rpe ? ` @ RPE ${s.rpe}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {e.notes && <p className="mt-2 text-xs text-muted-foreground">{e.notes}</p>}
            </section>
          ))}
          {session.notes && (
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="font-display text-lg font-semibold uppercase">Notes</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{session.notes}</p>
            </section>
          )}
        </div>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this workout?</DialogTitle>
            <DialogDescription>This permanently removes the workout and recalculates your personal records.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />} Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
