"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cloud, CloudOff, Flag, Loader2, Minus, Pause, Play, Plus, Timer, Trash2, Trophy, X } from "lucide-react";
import { Celebration } from "@/components/common/celebration";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/common/states";
import { cn } from "@/lib/utils";
import type { UnitSystem } from "@/lib/domain/types";
import { formatDuration, formatWeight } from "@/lib/domain/units";
import {
  createDraft,
  draftSummary,
  elapsedSeconds,
  isWorkoutDraft,
  newerDraft,
  restRemaining,
  workoutReducer,
  type DraftAction,
  type DraftExercise,
  type DraftTarget,
  type ExerciseRef,
  type WorkoutDraft,
} from "@/lib/domain/workout-draft";
import { cancelRestNotification, hapticSuccess, scheduleRestNotification } from "@/lib/native";
import { clearLocalDraft, loadLocalDraft, saveLocalDraft } from "@/lib/workout-storage";
import { discardWorkoutAction, finishWorkoutAction, syncWorkoutDraftAction, type UnlockedBadge } from "@/server/actions/workouts";
import { BadgeMedallion } from "@/components/achievements/badge-icon";
import { ExerciseCard } from "./exercise-card";
import { ExercisePicker, type CatalogItem } from "./exercise-picker";

export interface WorkoutTemplate {
  name: string;
  userProgramId: string | null;
  programDayId: string | null;
  warmup: string[];
  cooldown: string[];
  exercises: { exercise: ExerciseRef; restSeconds: number; target: DraftTarget | null }[];
}

interface LoggerProps {
  userId: string;
  units: UnitSystem;
  catalog: CatalogItem[];
  alternatives: Record<string, string[]>;
  serverDraft: unknown;
  template: WorkoutTemplate | null;
}

type Phase = "loading" | "conflict" | "active" | "finished";
type SyncState = "idle" | "saving" | "synced" | "local";

interface FinishResult {
  volumeKg: number;
  records: { exerciseId: string; recordType: string; value: number }[];
  badges: UnlockedBadge[];
  durationSeconds: number;
}

const RECORD_LABEL: Record<string, string> = {
  estimated_1rm: "estimated 1RM",
  max_weight: "heaviest set",
  max_reps: "most reps",
  max_set_volume: "best set volume",
  max_duration: "longest set",
};

function defaultName(): string {
  const d = new Date();
  const part = d.getHours() < 12 ? "Morning" : d.getHours() < 17 ? "Afternoon" : "Evening";
  return `${part} workout`;
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => ctx.close(), 600);
  } catch {
    /* audio not available */
  }
}

export function WorkoutLogger({ userId, units, catalog, alternatives, serverDraft, template }: LoggerProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [pendingExisting, setPendingExisting] = useState<WorkoutDraft | null>(null);
  const [now, setNow] = useState(() => new Date().toISOString());
  const [sync, setSync] = useState<SyncState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [substituteKey, setSubstituteKey] = useState<string | null>(null);
  const [skipKey, setSkipKey] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<FinishResult | null>(null);
  const [online, setOnline] = useState(true);
  const restWasRunning = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const catalogById = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);

  const freshFromTemplate = useCallback((): WorkoutDraft => {
    const nowIso = new Date().toISOString();
    if (template) {
      return createDraft({ name: template.name, now: nowIso, userProgramId: template.userProgramId, programDayId: template.programDayId, exercises: template.exercises });
    }
    return createDraft({ name: defaultName(), now: nowIso });
  }, [template]);

  // Restore on mount: prefer the most recently updated of local and server drafts.
  useEffect(() => {
    const local = loadLocalDraft(userId);
    const server = isWorkoutDraft(serverDraft) ? serverDraft : null;
    const existing = newerDraft(local, server);
    if (existing) {
      const wantsDifferentSession = template && template.programDayId !== existing.programDayId;
      if (wantsDifferentSession) {
        setPendingExisting(existing);
        setPhase("conflict");
        return;
      }
      setDraft(existing);
    } else {
      setDraft(freshFromTemplate());
    }
    setPhase("active");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clock tick for elapsed + rest timers.
  useEffect(() => {
    if (phase !== "active") return;
    const t = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const pushToServer = useCallback(async (d: WorkoutDraft) => {
    if (!navigator.onLine) {
      setSync("local");
      return;
    }
    setSync("saving");
    const res = await syncWorkoutDraftAction({
      clientId: d.clientId,
      name: d.name || "Workout",
      startedAt: d.startedAt,
      userProgramId: d.userProgramId,
      programDayId: d.programDayId,
      draft: d as unknown as Record<string, unknown>,
    }).catch(() => ({ ok: false as const, error: "offline" }));
    setSync(res.ok ? "synced" : "local");
  }, []);

  // Persist every change locally immediately, and to the server (debounced).
  useEffect(() => {
    if (!draft || phase !== "active") return;
    const ok = saveLocalDraft(userId, draft);
    if (!ok) setError("This device couldn't store your workout locally. Keep this tab open until you finish.");
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => void pushToServer(draft), 2000);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [draft, phase, userId, pushToServer]);

  // Re-sync when coming back online.
  useEffect(() => {
    if (online && draft && phase === "active" && sync === "local") void pushToServer(draft);
  }, [online, draft, phase, sync, pushToServer]);

  const dispatch = useCallback((action: DraftAction) => {
    if (action.type === "toggleSetComplete") void hapticSuccess();
    setDraft((d) => (d ? workoutReducer(d, action) : d));
  }, []);

  // Native: schedule a local notification for the end of rest so it fires while the app is backgrounded.
  const restEndsAt = draft?.rest.endsAt ?? null;
  useEffect(() => {
    if (restEndsAt) void scheduleRestNotification(restEndsAt);
    else void cancelRestNotification();
  }, [restEndsAt]);

  // Rest timer completion feedback.
  const rest = draft ? restRemaining(draft, now) : 0;
  useEffect(() => {
    if (!draft) return;
    if (rest > 0) restWasRunning.current = true;
    else if (restWasRunning.current && draft.rest.endsAt) {
      restWasRunning.current = false;
      if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
      beep();
      dispatch({ type: "clearRest" });
    }
  }, [rest, draft, dispatch]);

  if (phase === "loading" || (!draft && phase === "active")) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground" role="status">
        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden /> Restoring your workout…
      </div>
    );
  }

  if (phase === "conflict" && pendingExisting) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-gold-muted/60 bg-card p-6">
        <h1 className="font-display text-2xl font-bold uppercase">Workout in progress</h1>
        <p className="text-sm text-muted-foreground">
          You have an unfinished workout, <strong className="text-foreground">{pendingExisting.name}</strong>, started{" "}
          {new Date(pendingExisting.startedAt).toLocaleString()}. Resume it, or discard it and start {template?.name ?? "a new workout"}?
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setDraft(pendingExisting);
              setPendingExisting(null);
              setPhase("active");
            }}
          >
            Resume {pendingExisting.name}
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              await discardWorkoutAction(pendingExisting.clientId).catch(() => null);
              clearLocalDraft(userId);
              setPendingExisting(null);
              setDraft(freshFromTemplate());
              setPhase("active");
            }}
          >
            Discard &amp; start new
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "finished" && result) {
    return (
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <Celebration pieces={result.records.length > 0 ? 160 : 70} />
        <div className="mx-auto flex size-20 animate-bounce-in items-center justify-center rounded-full bg-gold-gradient text-black shadow-[0_0_40px_-6px_rgba(230,199,110,0.7)]">
          <Trophy className="size-9" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold uppercase">Workout complete</h1>
          <p className="mt-2 text-muted-foreground">Faithful in the small things. Well done.</p>
        </div>
        <dl className="stagger grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Duration</dt>
            <dd className="font-display text-2xl font-semibold">{formatDuration(result.durationSeconds)}</dd>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Volume</dt>
            <dd className="font-display text-2xl font-semibold">{formatWeight(result.volumeKg, units)}</dd>
          </div>
        </dl>
        {result.records.length > 0 && (
          <section className="animate-bounce-in rounded-2xl border border-gold-muted bg-gold/5 p-4 text-left [animation-delay:250ms]" aria-labelledby="prs-title">
            <h2 id="prs-title" className="mb-2 font-display text-lg font-semibold uppercase text-gold-highlight">
              New personal records
            </h2>
            <ul className="space-y-1 text-sm">
              {result.records.map((r, i) => (
                <li key={i}>
                  <strong>{catalogById.get(r.exerciseId)?.name ?? "Exercise"}</strong> — {RECORD_LABEL[r.recordType] ?? r.recordType}:{" "}
                  {r.recordType === "max_duration" ? formatDuration(r.value) : r.recordType === "max_reps" ? `${r.value} reps` : formatWeight(r.value, units)}
                </li>
              ))}
            </ul>
          </section>
        )}
        {result.badges.length > 0 && (
          <section className="space-y-2 text-left" aria-labelledby="badges-unlocked-title">
            <h2 id="badges-unlocked-title" className="font-display text-lg font-semibold uppercase text-gold-highlight">
              Badge unlocked!
            </h2>
            <ul className="space-y-2">
              {result.badges.map((b) => (
                <li key={b.id} className="flex items-center gap-4 rounded-2xl border border-gold-muted bg-gold/5 p-4 motion-safe:animate-fade-up">
                  <BadgeMedallion icon={b.icon} tier={b.tier} earned />
                  <div>
                    <p className="font-semibold">{b.name}</p>
                    <p className="text-sm text-muted-foreground">{b.description}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/progress/badges" className="inline-flex min-h-11 items-center text-sm font-semibold text-gold-highlight underline-offset-4 hover:underline">
              See all badges
            </Link>
          </section>
        )}
        {template?.cooldown && template.cooldown.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4 text-left">
            <h2 className="mb-2 font-display text-lg font-semibold uppercase">Cooldown</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {template.cooldown.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/home">Back to home</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/train/history">View history</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!draft) return null;
  const elapsed = elapsedSeconds(draft, now);
  const summary = draftSummary(draft);
  const paused = Boolean(draft.pausedAt);
  // The exercise being worked on: first one not skipped with sets still to complete.
  const currentKey = draft.exercises.find((e) => !e.skipped && (e.sets.length === 0 || e.sets.some((s) => !s.completed)))?.id;
  const substituteTarget = draft.exercises.find((e) => e.id === substituteKey) ?? null;

  const finish = async () => {
    setSaving(true);
    setError(null);
    const endedAt = new Date().toISOString();
    const finalDraft = draft.pausedAt ? workoutReducer(draft, { type: "resume", now: endedAt }) : draft;
    const payload = {
      clientId: finalDraft.clientId,
      name: finalDraft.name.trim() || "Workout",
      userProgramId: finalDraft.userProgramId,
      programDayId: finalDraft.programDayId,
      startedAt: finalDraft.startedAt,
      endedAt,
      pausedSeconds: finalDraft.pausedSeconds,
      notes: finalDraft.notes,
      exercises: finalDraft.exercises.map((e: DraftExercise) => ({
        exerciseId: e.exerciseId,
        substitutedFromId: e.substitutedFromId,
        notes: e.notes,
        skipped: e.skipped,
        skipReason: e.skipReason,
        sets: e.sets.map((s) => ({
          reps: s.reps,
          weightKg: s.weightKg,
          durationSeconds: s.durationSeconds,
          rpe: s.rpe,
          isWarmup: s.isWarmup,
          completed: s.completed,
        })),
      })),
    };
    const res = await finishWorkoutAction(payload).catch(() => ({ ok: false as const, error: "You appear to be offline. Your workout is saved on this device — try again when you're connected." }));
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      setFinishOpen(false);
      return;
    }
    clearLocalDraft(userId);
    void cancelRestNotification();
    setResult({ volumeKg: res.data.volumeKg, records: res.data.records, badges: res.data.badges ?? [], durationSeconds: elapsedSeconds(finalDraft, endedAt) });
    setPhase("finished");
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Sticky header */}
      <div className="sticky top-16 z-20 -mx-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-xl md:top-0 md:-mx-8 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="workout-name" className="sr-only">
              Workout name
            </label>
            <Input
              id="workout-name"
              value={draft.name}
              onChange={(e) => dispatch({ type: "rename", name: e.target.value })}
              className="h-9 border-transparent bg-transparent px-0 font-display text-xl font-bold uppercase focus-visible:border-border focus-visible:px-2"
              maxLength={120}
            />
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("font-display text-base font-semibold tabular-nums", paused ? "text-gold" : "text-foreground")} aria-live="off">
                {formatDuration(elapsed)}
              </span>
              {paused && <span className="text-gold">Paused</span>}
              <span aria-hidden>·</span>
              {summary.completedSets}/{summary.totalSets} sets
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1" role="status">
                {sync === "synced" ? (
                  <>
                    <Cloud className="size-3.5" aria-hidden /> Synced
                  </>
                ) : sync === "saving" ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden /> Saving
                  </>
                ) : sync === "local" ? (
                  <>
                    <CloudOff className="size-3.5" aria-hidden /> Saved on device
                  </>
                ) : null}
              </span>
            </p>
          </div>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => dispatch({ type: paused ? "resume" : "pause", now: new Date().toISOString() })}
            aria-label={paused ? "Resume workout" : "Pause workout"}
          >
            {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
          </Button>
          <Button onClick={() => setFinishOpen(true)}>
            <Flag aria-hidden /> Finish
          </Button>
        </div>

        {(rest > 0 || draft.rest.pausedRemaining) && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-gold-muted/60 bg-gold/10 px-3 py-2" role="timer" aria-label="Rest timer">
            <Timer className="size-5 text-gold" aria-hidden />
            <div className="flex-1">
              <p className="font-display text-2xl font-bold tabular-nums text-gold-highlight" aria-live="polite" aria-atomic>
                {formatDuration(rest)}
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                <div className="h-full bg-gold-gradient transition-[width] duration-1000" style={{ width: `${draft.rest.durationSeconds ? (rest / draft.rest.durationSeconds) * 100 : 0}%` }} />
              </div>
            </div>
            <Button size="icon-sm" variant="ghost" onClick={() => dispatch({ type: "adjustRest", deltaSeconds: -15, now: new Date().toISOString() })} aria-label="Subtract 15 seconds">
              <Minus aria-hidden />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => dispatch({ type: "adjustRest", deltaSeconds: 15, now: new Date().toISOString() })} aria-label="Add 15 seconds">
              <Plus aria-hidden />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "clearRest" })}>
              Skip
            </Button>
          </div>
        )}
      </div>

      {!online && <Notice tone="warning">You&apos;re offline. Keep logging — everything is saved on this device and will sync when you reconnect.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      {template && template.warmup.length > 0 && summary.completedSets === 0 && (
        <details className="rounded-2xl border border-border bg-card p-4">
          <summary className="cursor-pointer font-display text-lg font-semibold uppercase">Warm-up</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {template.warmup.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      {draft.exercises.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="font-semibold">No exercises yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add your first exercise to start logging.</p>
        </div>
      )}

      {draft.exercises.map((e, i) => (
        <ExerciseCard
          key={e.id}
          current={e.id === currentKey}
          exercise={e}
          index={i}
          total={draft.exercises.length}
          units={units}
          dispatch={dispatch}
          onSubstitute={() => setSubstituteKey(e.id)}
          onSkip={() => setSkipKey(e.id)}
        />
      ))}

      <Button variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
        <Plus aria-hidden /> Add exercise
      </Button>

      <section className="rounded-2xl border border-border bg-card p-4">
        <label htmlFor="workout-notes" className="font-display text-lg font-semibold uppercase">
          Workout notes
        </label>
        <Textarea id="workout-notes" className="mt-2" value={draft.notes} onChange={(e) => dispatch({ type: "setNotes", notes: e.target.value })} placeholder="How did the session feel?" maxLength={2000} />
      </section>

      <Button variant="ghost" className="w-full text-[#f08a8a]" onClick={() => setDiscardOpen(true)}>
        <Trash2 aria-hidden /> Discard workout
      </Button>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Add exercise"
        catalog={catalog}
        onPick={(item) => dispatch({ type: "addExercise", exercise: { id: item.id, slug: item.slug, name: item.name, isTimed: item.isTimed }, restSeconds: item.isTimed ? 45 : 90 })}
      />
      <ExercisePicker
        open={Boolean(substituteTarget)}
        onOpenChange={(o) => !o && setSubstituteKey(null)}
        title="Substitute exercise"
        description={substituteTarget ? `Replace ${substituteTarget.name}. Your sets and reps carry over; weights reset.` : undefined}
        catalog={catalog}
        suggestedIds={substituteTarget ? (alternatives[substituteTarget.exerciseId] ?? []) : []}
        excludeId={substituteTarget?.exerciseId}
        onPick={(item) =>
          substituteTarget &&
          dispatch({ type: "substituteExercise", exerciseKey: substituteTarget.id, replacement: { id: item.id, slug: item.slug, name: item.name, isTimed: item.isTimed } })
        }
      />

      <Dialog open={Boolean(skipKey)} onOpenChange={(o) => !o && setSkipKey(null)}>
        <DialogContent side="bottom">
          <DialogHeader>
            <DialogTitle>Skip exercise</DialogTitle>
            <DialogDescription>
              If an exercise causes pain, stop and skip it. This app can&apos;t assess injuries — persistent or sharp pain should be checked by a qualified
              professional.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["pain", "Causes pain"],
                ["equipment", "No equipment"],
                ["time", "Short on time"],
                ["other", "Other reason"],
              ] as const
            ).map(([reason, label]) => (
              <Button
                key={reason}
                variant="secondary"
                onClick={() => {
                  if (skipKey) dispatch({ type: "skipExercise", exerciseKey: skipKey, reason });
                  setSkipKey(null);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish workout?</DialogTitle>
            <DialogDescription>
              {summary.completedSets} of {summary.totalSets} sets completed across {summary.exercises} exercises · {formatDuration(elapsed)}. Only sets marked
              complete count toward volume and records.
            </DialogDescription>
          </DialogHeader>
          {summary.completedSets === 0 && <Notice tone="warning">Mark at least one set complete before finishing.</Notice>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setFinishOpen(false)}>
              Keep training
            </Button>
            <Button onClick={finish} disabled={saving || summary.completedSets === 0} aria-busy={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              {saving ? "Saving…" : "Finish & save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this workout?</DialogTitle>
            <DialogDescription>Everything logged in this session will be deleted. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDiscardOpen(false)}>
              <X aria-hidden /> Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const res = await discardWorkoutAction(draft.clientId).catch(() => ({ ok: false as const, error: "offline" }));
                if (!res.ok && navigator.onLine) {
                  setError("Couldn't discard on the server. Please try again.");
                  setDiscardOpen(false);
                  return;
                }
                clearLocalDraft(userId);
                router.push("/train");
              }}
            >
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
