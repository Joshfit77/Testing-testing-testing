"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing, BookmarkPlus, Cloud, CloudOff, Flag, Loader2, Minus, Pause, Play, Plus, Timer, Trash2, Trophy, Vibrate, X } from "lucide-react";
import { Celebration } from "@/components/common/celebration";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/common/states";
import { cn } from "@/lib/utils";
import type { UnitSystem } from "@/lib/domain/types";
import { formatDuration, formatWeight } from "@/lib/domain/units";
import {
  createDraft,
  draftAgeHours,
  draftSummary,
  elapsedSeconds,
  migrateDraft,
  newerDraft,
  nextUp,
  STALE_DRAFT_HOURS,
  supersetMembers,
  restRemaining,
  workoutReducer,
  type DraftAction,
  type DraftExercise,
  type DraftTarget,
  type ExerciseRef,
  type WorkoutDraft,
} from "@/lib/domain/workout-draft";
import { cancelRestNotification, hapticSuccess, scheduleRestNotification } from "@/lib/native";
import { clearLocalDraft, clearPendingDiscard, loadLocalDraft, loadPendingDiscard, saveLocalDraft, savePendingDiscard } from "@/lib/workout-storage";
import { discardWorkoutAction, finishWorkoutAction, previousPerformanceAction, syncWorkoutDraftAction, type NextSession, type UnlockedBadge } from "@/server/actions/workouts";
import { updateRestAlertsAction } from "@/server/actions/rest-alerts";
import { createTemplateAction } from "@/server/actions/templates";
import { lastTimeText, targetText, type PreviousPerformance } from "@/lib/domain/previous-performance";
import { templateFromDraft } from "@/lib/domain/workout-templates";
import { BadgeMedallion } from "@/components/achievements/badge-icon";
import { ExerciseCard } from "./exercise-card";
import { ExercisePicker, type CatalogItem } from "./exercise-picker";

export interface WorkoutTemplate {
  name: string;
  userProgramId: string | null;
  programDayId: string | null;
  /** Set when started from a saved workout template. */
  templateId?: string | null;
  warmup: string[];
  cooldown: string[];
  exercises: { exercise: ExerciseRef; restSeconds: number; target: DraftTarget | null; supersetGroup?: number | null }[];
}

interface LoggerProps {
  userId: string;
  units: UnitSystem;
  catalog: CatalogItem[];
  alternatives: Record<string, string[]>;
  serverDraft: unknown;
  template: WorkoutTemplate | null;
  /** Latest completed performance per exercise id ("Last time"). */
  previous?: Record<string, PreviousPerformance>;
  /** Target loads the member accepted from the training review or the AI coach, by exercise id. */
  targets?: Record<string, { weightKg: number | null; reps: number | null }>;
  /** Rest-timer alerts (Profile setting): a beep and/or a vibration when rest ends. */
  restAlerts?: { sound: boolean; vibrate: boolean };
  /** A message from the page about how the workout was set up (shown under the header). */
  notice?: string | null;
}

type Phase = "loading" | "conflict" | "active" | "finished";
type SyncState = "idle" | "saving" | "synced" | "local";

interface FinishResult {
  volumeKg: number;
  records: { exerciseId: string; recordType: string; value: number; first?: boolean }[];
  badges: UnlockedBadge[];
  durationSeconds: number;
  /** What the program has next, so the member leaves knowing what to do. */
  next: NextSession | null;
}

/** A second tap on Done within this time is the same tap (a bounce, a shaky hand), not an undo. */
const DOUBLE_TAP_MS = 700;

function ageText(hours: number): string {
  if (hours < 24) return `${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
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

export function WorkoutLogger({ userId, units, catalog, alternatives, serverDraft, template, previous = {}, targets: initialTargets = {}, restAlerts = { sound: true, vibrate: true }, notice = null }: LoggerProps) {
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
  const [discarding, setDiscarding] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<FinishResult | null>(null);
  const [online, setOnline] = useState(true);
  const [prev, setPrev] = useState<Record<string, PreviousPerformance>>(previous);
  const [targets, setTargets] = useState(initialTargets);
  const asked = useRef(new Set(Object.keys(previous)));
  const [alerts, setAlerts] = useState(restAlerts);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [finishedDraft, setFinishedDraft] = useState<WorkoutDraft | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateState, setTemplateState] = useState<{ saving: boolean; error: string | null; savedId: string | null }>({ saving: false, error: null, savedId: null });
  const restWasRunning = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Nothing is saved (here or on the server) until the member has done something: opening the logger to look at
  // the session and leaving again must not leave a "Resume workout" behind.
  const touched = useRef(false);
  const latest = useRef<WorkoutDraft | null>(null);
  const retryDelay = useRef(0);
  const lastToggle = useRef(new Map<string, number>());
  const prefilled = useRef(new Set<string>());
  const [staleHours, setStaleHours] = useState<number | null>(null);

  const catalogById = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);

  const freshFromTemplate = useCallback((): WorkoutDraft => {
    const nowIso = new Date().toISOString();
    if (template) {
      return createDraft({ name: template.name, now: nowIso, userProgramId: template.userProgramId, programDayId: template.programDayId, templateId: template.templateId ?? null, exercises: template.exercises });
    }
    return createDraft({ name: defaultName(), now: nowIso });
  }, [template]);

  // Restore on mount: prefer the most recently updated of local and server drafts.
  useEffect(() => {
    // A discard the server never heard about (offline at the time): finish it now, and don't bring that draft back.
    const pendingDiscard = loadPendingDiscard(userId);
    let local = loadLocalDraft(userId);
    // Drafts saved by an older version of the app (v1) are migrated to the current format.
    let server = migrateDraft(serverDraft);
    if (pendingDiscard) {
      if (local?.clientId === pendingDiscard) {
        clearLocalDraft(userId);
        local = null;
      }
      if (server?.clientId === pendingDiscard) server = null;
      void discardWorkoutAction(pendingDiscard)
        .then((r) => r.ok && clearPendingDiscard(userId))
        .catch(() => null);
    }
    const existing = newerDraft(local, server);
    if (existing) {
      const wantsDifferentSession = template && (template.programDayId !== existing.programDayId || (template.templateId ?? null) !== (existing.templateId ?? null));
      // A draft from hours or days ago is not resumed silently: the member says whether it is still this workout.
      const age = draftAgeHours(existing, new Date().toISOString());
      if (wantsDifferentSession || age >= STALE_DRAFT_HOURS) {
        setPendingExisting(existing);
        setStaleHours(age >= STALE_DRAFT_HOURS ? age : null);
        setPhase("conflict");
        return;
      }
      touched.current = true;
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
      name: d.name.trim() || "Workout",
      startedAt: d.startedAt,
      userProgramId: d.userProgramId,
      programDayId: d.programDayId,
      draft: d as unknown as Record<string, unknown>,
    }).catch(() => ({ ok: false as const, error: "offline" }));
    if (res.ok) {
      retryDelay.current = 0;
      setSync("synced");
      return;
    }
    setSync("local");
    // Try again later, waiting longer each time (gym Wi-Fi with no internet behind it, a server hiccup) rather than
    // hammering the connection; the next edit tries again sooner.
    retryDelay.current = Math.min(120_000, retryDelay.current ? retryDelay.current * 3 : 5_000);
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      if (latest.current) void pushToServer(latest.current);
    }, retryDelay.current);
  }, []);

  // Persist every change locally immediately, and to the server (debounced), once the member has done something.
  useEffect(() => {
    latest.current = draft;
    if (!draft || phase !== "active" || !touched.current) return;
    const ok = saveLocalDraft(userId, draft);
    if (!ok) setError("This device couldn't store your workout locally. Keep this tab open until you finish.");
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => void pushToServer(draft), 2000);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [draft, phase, userId, pushToServer]);

  // Empty fields take last time's numbers (the target's reps stay): the member corrects a value instead of typing
  // every one. Only sets not yet done, and never a value already typed.
  useEffect(() => {
    if (!draft || phase !== "active") return;
    for (const e of draft.exercises) {
      const p = prev[e.exerciseId];
      if (!p || prefilled.current.has(e.id)) continue;
      prefilled.current.add(e.id);
      const working = p.sets.filter((x) => x.completed && !x.isWarmup).map((x) => ({ reps: x.reps, weightKg: x.weightKg, durationSeconds: x.durationSeconds, distanceM: x.distanceM }));
      if (working.length) setDraft((d) => (d ? workoutReducer(d, { type: "prefillFromPrevious", exerciseKey: e.id, sets: working }) : d));
    }
  }, [draft, prev, phase]);

  // "Last time" for exercises added during the workout (the page preloads the starting ones).
  const exerciseIds = draft ? draft.exercises.map((e) => e.exerciseId).join(",") : "";
  useEffect(() => {
    if (!exerciseIds || !navigator.onLine) return;
    const missing = [...new Set(exerciseIds.split(","))].filter((id) => !asked.current.has(id));
    if (!missing.length) return;
    missing.forEach((id) => asked.current.add(id));
    void previousPerformanceAction(missing)
      .then((res) => {
        if (res.ok) {
          setPrev((p) => ({ ...p, ...res.data }));
          if (res.targets) setTargets((t) => ({ ...t, ...res.targets }));
        }
      })
      .catch(() => missing.forEach((id) => asked.current.delete(id)));
  }, [exerciseIds]);

  // Re-sync when coming back online (on that change only: a failed attempt schedules its own retry).
  useEffect(() => {
    if (online && phase === "active" && touched.current && latest.current) void pushToServer(latest.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const dispatch = useCallback((action: DraftAction) => {
    if (action.type === "toggleSetComplete") {
      const t = Date.now();
      if (t - (lastToggle.current.get(action.setId) ?? 0) < DOUBLE_TAP_MS) return;
      lastToggle.current.set(action.setId, t);
      void hapticSuccess();
    }
    touched.current = true;
    setDraft((d) => (d ? workoutReducer(d, action) : d));
  }, []);

  // Native: schedule a local notification for the end of rest so it fires while the app is backgrounded (only when
  // the member wants rest alerts at all), naming the exercise the next set is on.
  const restEndsAt = draft?.rest.endsAt ?? null;
  const nextName = draft ? (draft.exercises.find((e) => e.id === nextUp(draft)?.exerciseKey)?.name ?? null) : null;
  const wantsAlert = alerts.sound || alerts.vibrate;
  useEffect(() => {
    if (restEndsAt && wantsAlert) void scheduleRestNotification(restEndsAt, nextName ?? undefined);
    else void cancelRestNotification();
    // (The exercise name only matters at scheduling time.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restEndsAt, wantsAlert]);

  // Rest timer completion feedback.
  const rest = draft ? restRemaining(draft, now) : 0;
  useEffect(() => {
    if (!draft) return;
    if (rest > 0) restWasRunning.current = true;
    else if (restWasRunning.current && draft.rest.endsAt) {
      restWasRunning.current = false;
      if (alerts.vibrate && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
      if (alerts.sound) beep();
      dispatch({ type: "clearRest" });
    }
  }, [rest, draft, dispatch, alerts]);

  const saveAlerts = async (next: { sound: boolean; vibrate: boolean }) => {
    const before = alerts;
    setAlerts(next);
    setAlertsError(null);
    if (next.sound && !before.sound) beep(); // a short preview, which also unlocks audio on iOS
    if (next.vibrate && !before.vibrate && "vibrate" in navigator) navigator.vibrate?.(80);
    const res = await updateRestAlertsAction(next).catch(() => ({ ok: false as const, message: "You appear to be offline." }));
    if (!res.ok) {
      setAlerts(before);
      setAlertsError(res.message ?? "Couldn't save that setting.");
    }
  };

  if (phase === "loading" || (!draft && phase === "active")) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground" role="status">
        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden /> Restoring your workout…
      </div>
    );
  }

  if (phase === "conflict" && pendingExisting) {
    const done = draftSummary(pendingExisting).completedSets;
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-gold-muted/60 bg-card p-6">
        <h1 className="font-display text-2xl font-bold uppercase">{staleHours !== null ? "Unfinished workout" : "Workout in progress"}</h1>
        <p className="text-sm text-muted-foreground">
          You have an unfinished workout, <strong className="text-foreground">{pendingExisting.name}</strong>
          {staleHours !== null ? ` (last used ${ageText(staleHours)}, ${done} ${done === 1 ? "set" : "sets"} logged)` : `, started ${new Date(pendingExisting.startedAt).toLocaleString()}`}.{" "}
          {staleHours !== null && !template ? "Carry on with it, or discard it and start fresh?" : `Resume it, or discard it and start ${template?.name ?? "a new workout"}?`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              // Time away is not training time; a rest that ended long ago is gone.
              const resumed = workoutReducer(pendingExisting, { type: "continueAfterGap", now: new Date().toISOString() });
              touched.current = true;
              setDraft(resumed);
              setPendingExisting(null);
              setPhase("active");
            }}
          >
            Resume {pendingExisting.name}
          </Button>
          <Button
            variant="secondary"
            disabled={discarding}
            onClick={async () => {
              // Discarding deletes the unfinished workout, so it asks first.
              const ok = await confirmDialog({
                title: `Discard ${pendingExisting.name}?`,
                message: "The unfinished workout and the sets you logged in it are deleted. This can't be undone.",
                confirmLabel: "Discard",
                destructive: true,
              });
              if (!ok) return;
              setDiscarding(true);
              try {
                const res = await discardWorkoutAction(pendingExisting.clientId).catch(() => ({ ok: false as const }));
                // (Offline, or the server said no: the discard is finished on the next visit; the draft stays gone here.)
                if (!res.ok) savePendingDiscard(userId, pendingExisting.clientId);
                clearLocalDraft(userId);
                void cancelRestNotification();
                setPendingExisting(null);
                setDraft(freshFromTemplate());
                setPhase("active");
              } finally {
                setDiscarding(false);
              }
            }}
          >
            {discarding ? "Discarding…" : "Discard & start new"}
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
        {result.next && (
          <section className="rounded-2xl border border-border bg-card p-4 text-left" aria-labelledby="next-title">
            <h2 id="next-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {result.next.programDone ? "Program complete" : "Up next"}
            </h2>
            {result.next.programDone ? (
              <p className="mt-1 text-sm">
                That was the last session of <strong>{result.next.programName}</strong>. Choose your next program in Train.
              </p>
            ) : (
              <>
                <p className="mt-1 text-lg font-semibold">{result.next.name}</p>
                <p className="text-sm text-muted-foreground">
                  Week {result.next.week} of {result.next.durationWeeks} · Day {result.next.day} of {result.next.daysPerWeek}
                  {result.next.date ? ` · ${new Date(`${result.next.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}` : ""}
                  {result.next.minutes ? ` · ~${result.next.minutes} min` : ""}
                </p>
              </>
            )}
          </section>
        )}
        {result.records.some((r) => !r.first) && (
          <section className="animate-bounce-in rounded-2xl border border-gold-muted bg-gold/5 p-4 text-left [animation-delay:250ms]" aria-labelledby="prs-title">
            <h2 id="prs-title" className="mb-2 font-display text-lg font-semibold uppercase text-gold-highlight">
              New personal records
            </h2>
            <ul className="space-y-1 text-sm">
              {result.records.filter((r) => !r.first).map((r, i) => (
                <li key={i}>
                  <strong>{catalogById.get(r.exerciseId)?.name ?? "Exercise"}</strong> — {RECORD_LABEL[r.recordType] ?? r.recordType}:{" "}
                  {r.recordType === "max_duration" ? formatDuration(r.value) : r.recordType === "max_reps" ? `${r.value} reps` : formatWeight(r.value, units)}
                </li>
              ))}
            </ul>
          </section>
        )}
        {result.records.some((r) => r.first) && (
          <section className="rounded-2xl border border-border bg-card p-4 text-left" aria-labelledby="baselines-title">
            <h2 id="baselines-title" className="mb-1 font-display text-lg font-semibold uppercase">
              Baselines set
            </h2>
            <p className="mb-2 text-xs text-muted-foreground">First time logged: your next sessions are measured against these.</p>
            <ul className="space-y-1 text-sm">
              {[...new Set(result.records.filter((r) => r.first).map((r) => r.exerciseId))].map((id) => {
                const best = result.records.find((r) => r.exerciseId === id && r.first && r.recordType === "max_weight") ?? result.records.find((r) => r.exerciseId === id && r.first);
                if (!best) return null;
                return (
                  <li key={id}>
                    <strong>{catalogById.get(id)?.name ?? "Exercise"}</strong> — {RECORD_LABEL[best.recordType] ?? best.recordType}:{" "}
                    {best.recordType === "max_duration" ? formatDuration(best.value) : best.recordType === "max_reps" ? `${best.value} reps` : formatWeight(best.value, units)}
                  </li>
                );
              })}
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
        {finishedDraft && finishedDraft.exercises.some((e) => !e.skipped) && (
          <section className="rounded-2xl border border-border bg-card p-4 text-left" aria-labelledby="save-template-title">
            <h2 id="save-template-title" className="font-display text-lg font-semibold uppercase">
              Save as a template
            </h2>
            {templateState.savedId ? (
              <p className="mt-1 text-sm" role="status">
                Saved to{" "}
                <Link href="/train/templates" className="font-semibold text-gold-highlight underline-offset-4 hover:underline">
                  My workouts
                </Link>
                . Start it again any time.
              </p>
            ) : (
              <form
                className="mt-2 flex flex-col gap-2 sm:flex-row"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setTemplateState({ saving: true, error: null, savedId: null });
                  const input = { ...templateFromDraft(finishedDraft), name: templateName.trim() || finishedDraft.name };
                  const res = await createTemplateAction(input).catch(() => ({ ok: false as const, error: "You appear to be offline. Try again when you're connected." }));
                  setTemplateState(res.ok ? { saving: false, error: null, savedId: res.data.id } : { saving: false, error: res.error, savedId: null });
                }}
              >
                <label htmlFor="template-name" className="sr-only">
                  Template name
                </label>
                <Input id="template-name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder={finishedDraft.name} maxLength={120} className="flex-1" />
                <Button type="submit" variant="secondary" disabled={templateState.saving} aria-busy={templateState.saving}>
                  {templateState.saving ? <Loader2 className="animate-spin" aria-hidden /> : <BookmarkPlus aria-hidden />} Save template
                </Button>
              </form>
            )}
            {templateState.error && <Notice tone="error" className="mt-2">{templateState.error}</Notice>}
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
  // The set to do next: the first exercise with work left — inside a superset, alternating A1, B1, A2, B2.
  const up = nextUp(draft);
  const currentKey = up?.exerciseKey;
  // Superset letters in order of appearance.
  const letters = new Map<string, string>();
  for (const e of draft.exercises) if (e.supersetId && !letters.has(e.supersetId)) letters.set(e.supersetId, String.fromCharCode(65 + letters.size));
  const substituteTarget = draft.exercises.find((e) => e.id === substituteKey) ?? null;

  const finish = async () => {
    setSaving(true);
    setError(null);
    // The end time is when Finish was first tapped: a retry after the network came back doesn't stretch the workout.
    const asked = workoutReducer(draft, { type: "requestFinish", now: new Date().toISOString() });
    if (asked !== draft) setDraft(asked);
    const endedAt = asked.finishRequestedAt!;
    const finalDraft = asked.pausedAt ? workoutReducer(asked, { type: "resume", now: endedAt }) : asked;
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
          distanceM: s.distanceM ?? null,
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
    setFinishedDraft(finalDraft);
    setTemplateName(finalDraft.name);
    setResult({ volumeKg: res.data.volumeKg, records: res.data.records, badges: res.data.badges ?? [], durationSeconds: elapsedSeconds(finalDraft, endedAt), next: res.data.next ?? null });
    setPhase("finished");
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Sticky header. On phones it starts at the very top of the screen (pulled up over the page's own top
          padding) and pads itself below the status bar, so nothing scrolls into view above or behind it. */}
      <div className="sticky top-0 z-20 -mx-4 -mt-[calc(env(safe-area-inset-top)+0.25rem)] border-b border-border bg-background/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl md:-mx-8 md:mt-0 md:px-8 md:pt-3">
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
              <p className="font-display text-2xl font-bold tabular-nums text-gold-highlight">
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

      {notice && <p className="rounded-xl border border-gold-muted/50 bg-gold/5 px-4 py-3 text-sm">{notice}</p>}
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

      {draft.exercises.map((e, i) => {
        const members = e.supersetId ? supersetMembers(draft, e.id) : [];
        const nextEx = draft.exercises[i + 1];
        return (
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
            lastTime={lastTimeText(prev[e.exerciseId], units, e.isTimed)}
            coachTarget={targetText(targets[e.exerciseId], units)}
            nextSetId={up?.exerciseKey === e.id ? up.setId : null}
            superset={{
              letter: e.supersetId ? (letters.get(e.supersetId) ?? null) : null,
              position: members.findIndex((m) => m.id === e.id),
              size: members.length,
              canLinkNext: Boolean(nextEx && (!e.supersetId || nextEx.supersetId !== e.supersetId)),
            }}
          />
        );
      })}

      <Button variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
        <Plus aria-hidden /> Add exercise
      </Button>

      <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="rest-alerts-title">
        <h2 id="rest-alerts-title" className="font-display text-lg font-semibold uppercase">
          Rest timer alerts
        </h2>
        <p className="text-xs text-muted-foreground">When a rest ends. Saved to your profile.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button type="button" variant={alerts.sound ? "default" : "secondary"} aria-pressed={alerts.sound} onClick={() => void saveAlerts({ ...alerts, sound: !alerts.sound })}>
            <BellRing aria-hidden /> Sound {alerts.sound ? "on" : "off"}
          </Button>
          <Button type="button" variant={alerts.vibrate ? "default" : "secondary"} aria-pressed={alerts.vibrate} onClick={() => void saveAlerts({ ...alerts, vibrate: !alerts.vibrate })}>
            <Vibrate aria-hidden /> Vibrate {alerts.vibrate ? "on" : "off"}
          </Button>
        </div>
        {typeof navigator !== "undefined" && !("vibrate" in navigator) && alerts.vibrate && (
          <p className="mt-1 text-xs text-muted-foreground">This browser can&apos;t vibrate (iPhone Safari doesn&apos;t support it); the installed app uses its own notification.</p>
        )}
        {alertsError && <Notice tone="error" className="mt-2">{alertsError}</Notice>}
      </section>

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
        description={
          substituteTarget
            ? (() => {
                const done = substituteTarget.sets.filter((x) => x.completed).length;
                return done
                  ? `The ${done} ${done === 1 ? "set" : "sets"} you've done stay logged under ${substituteTarget.name}; the rest move to the new exercise (reps carry over, weight resets).`
                  : `Replace ${substituteTarget.name}. Reps carry over; the weight resets for the new exercise.`;
              })()
            : undefined
        }
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
                // The server's copy goes on the next visit if it couldn't go now; it is never brought back meanwhile.
                if (!res.ok) savePendingDiscard(userId, draft.clientId);
                clearLocalDraft(userId);
                void cancelRestNotification();
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
