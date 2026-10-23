"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flag, Loader2, LocateFixed, Pause, Play, Save, SignalZero, Trash2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/common/states";
import { confirmDialog } from "@/components/ui/confirm";
import { RouteMap } from "@/components/run/route-map";
import { formatDistance, formatHms, formatPace, paceSecondsPer, type ActivityKind, type DistanceUnit } from "@/lib/domain/activities";
import {
  addFix,
  currentPace,
  finishTrack,
  isResumable,
  pauseTrack,
  recoverTrack,
  resumeTrack,
  routeForSave,
  startTrack,
  tick,
  trackTotals,
  type TrackState,
} from "@/lib/domain/gps-track";
import { buildScript, completedSets, phaseAt, scriptSeconds, type RunPrescription } from "@/lib/domain/run-session";
import { hasNativeBackgroundLocation, keepScreenOn, locationSourceLabel, watchLocation, type LocationError } from "@/lib/native/location";
import { saveGpsActivityAction } from "@/server/actions/gps-activities";

export interface GuidedSession {
  userProgramId: string;
  programDayId: string;
  dayName: string;
  programName: string;
  prescriptions: RunPrescription[];
}

interface Saved {
  track: TrackState;
  guidedDayId: string | null;
}

const ERROR_TEXT: Record<LocationError, string> = {
  denied: "Location permission is off for this app. Turn it on in your browser or phone settings to record a run or walk.",
  unavailable: "Your location isn't available right now. Check that location services are on, or try again outdoors.",
  unsupported: "This browser can't share its location. Try another browser or the app.",
  timeout: "Still waiting for a GPS fix. Move to an open area away from tall buildings.",
};

export function GpsRecorder({ userId, units, initialKind, guided }: { userId: string; units: "metric" | "imperial"; initialKind: ActivityKind; guided: GuidedSession | null }) {
  const router = useRouter();
  const unit: DistanceUnit = units === "imperial" ? "mi" : "km";
  const storageKey = `run.recording.${userId}`;
  const [kind, setKind] = useState<ActivityKind>(guided ? "run" : initialKind);
  const [track, setTrack] = useState<TrackState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<LocationError | null>(null);
  const [recoverable, setRecoverable] = useState<Saved | null>(null);
  const [voice, setVoice] = useState(false);
  const [effort, setEffort] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const wakeRef = useRef<(() => void) | null>(null);
  // Two taps in the same frame both see `saving` as false; the ref stops the second one.
  const savingRef = useRef(false);
  const lastSaveRef = useRef(0);
  const script = useMemo(() => (guided ? buildScript(guided.prescriptions) : null), [guided]);
  const lastPhaseRef = useRef<number>(-1);

  // A recording left unfinished on this device (closed tab, crash, phone restart): offer to continue it.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Saved;
      if (isResumable(saved.track, Date.now()) && (saved.guidedDayId ?? null) === (guided?.programDayId ?? null)) setRecoverable(saved);
      else if (!isResumable(saved.track, Date.now())) localStorage.removeItem(storageKey);
    } catch {
      /* storage unavailable: nothing to recover */
    }
  }, [storageKey, guided?.programDayId]);

  const persist = useCallback(
    (t: TrackState | null, force = false) => {
      try {
        if (!t) {
          localStorage.removeItem(storageKey);
          return;
        }
        if (!force && Date.now() - lastSaveRef.current < 5000) return;
        lastSaveRef.current = Date.now();
        localStorage.setItem(storageKey, JSON.stringify({ track: t, guidedDayId: guided?.programDayId ?? null } satisfies Saved));
      } catch {
        /* storage full or blocked: the recording continues in memory */
      }
    },
    [storageKey, guided?.programDayId],
  );

  const stopWatching = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    wakeRef.current?.();
    wakeRef.current = null;
  }, []);

  const beginWatching = useCallback(async () => {
    setError(null);
    stopWatching();
    stopRef.current = await watchLocation(
      (fix) => {
        // A fix means the signal is back: drop a warning left by a brief loss (tunnels, tall buildings).
        setError(null);
        setTrack((t) => (t ? addFix(t, fix).state : t));
      },
      (e) => setError(e),
    );
    if (!hasNativeBackgroundLocation()) wakeRef.current = await keepScreenOn();
  }, [stopWatching]);

  useEffect(() => () => stopWatching(), [stopWatching]);

  // Clock: elapsed time, signal-loss detection and the guided script.
  const active = track && (track.status === "recording" || track.status === "acquiring");
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setTrack((cur) => (cur ? tick(cur, t) : cur));
    }, 1000);
    return () => clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (track) persist(track, track.status !== "recording");
  }, [track, persist]);

  const moving = track ? Math.round(((): number => {
    let ms = 0;
    for (const p of track.periods) ms += Math.max(0, (p.end ?? now) - p.start);
    return ms / 1000;
  })()) : 0;
  const elapsed = track ? Math.max(0, Math.round(((track.finishedAt ?? now) - track.startedAt) / 1000)) : 0;
  const phase = script ? phaseAt(script, moving) : null;

  // Cue each phase change (vibration where supported, optional voice).
  useEffect(() => {
    if (!phase || !track || track.status !== "recording") return;
    if (phase.index === lastPhaseRef.current) return;
    lastPhaseRef.current = phase.index;
    try {
      navigator.vibrate?.([200, 100, 200]);
      if (voice && "speechSynthesis" in window) {
        const text = phase.phase ? `${phase.phase.label}, ${Math.round(phase.phase.seconds / 60) || phase.phase.seconds} ${phase.phase.seconds >= 60 ? "minutes" : "seconds"}` : "Session complete. Well done.";
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      }
    } catch {
      /* cues are optional */
    }
  }, [phase, track, voice]);

  const start = async () => {
    const t = startTrack({ id: crypto.randomUUID(), kind, unit, now: Date.now() });
    lastPhaseRef.current = -1;
    setTrack(t);
    setNow(Date.now());
    persist(t, true);
    await beginWatching();
  };

  const continueRecording = async () => {
    if (!recoverable) return;
    const t = recoverTrack(recoverable.track);
    setKind(t.kind);
    setTrack(t);
    setRecoverable(null);
    if (t.status !== "paused") await beginWatching();
  };

  const discard = async () => {
    const ok = await confirmDialog({ title: `Discard this ${kind}?`, message: "The recording is deleted from this device and nothing is saved.", confirmLabel: "Discard", destructive: true });
    if (!ok) return;
    stopWatching();
    setTrack(null);
    setRecoverable(null);
    persist(null);
  };

  const finish = () => {
    stopWatching();
    setTrack((t) => (t ? finishTrack(t, Date.now()) : t));
  };

  const save = async () => {
    if (!track || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    const totals = trackTotals(track);
    try {
      const res = await saveGpsActivityAction({
        id: track.id,
        kind: track.kind,
        startedAt: track.startedAt,
        finishedAt: track.finishedAt ?? Date.now(),
        distanceM: totals.distance_m,
        elapsedS: totals.elapsed_s,
        movingS: totals.moving_s,
        splits: track.splits,
        route: routeForSave(track),
        gpsQuality: { gaps: track.gaps, rejected: Object.values(track.rejected).reduce((a, b) => a + b, 0), lastAccuracy: track.lastAccuracy },
        effort: effort ? Number(effort) : null,
        notes: notes.trim() || null,
        program: guided && script ? { userProgramId: guided.userProgramId, programDayId: guided.programDayId, completedSets: completedSets(script, guided.prescriptions.length, totals.moving_s) } : null,
      });
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      persist(null);
      router.push(`/run/activities/${res.id}?saved=1`);
      router.refresh();
    } catch {
      setSaveError(navigator.onLine ? "Couldn't reach the server. Your recording is still on this device: try again." : "You're offline. Your recording is kept on this device: save it when you're back online.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const distance = track?.distanceM ?? 0;
  const pace = track ? currentPace(track, now) : null;
  const avgPace = paceSecondsPer(distance, Math.max(1, moving), unit);
  const route = track ? routeForSave(track, 600) : null;

  // ------------------------------------------------------------------ Not started
  if (!track) {
    return (
      <div className="space-y-4">
        {recoverable && (
          <Notice tone="warning">
            <p className="font-semibold">You have an unfinished {recoverable.track.kind} from {new Date(recoverable.track.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.</p>
            <p className="mt-1 text-sm">Continue it, or discard it. Any time the app was closed is kept as a gap: no distance is guessed for it.</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={continueRecording}>
                Continue recording
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  persist(null);
                  setRecoverable(null);
                }}
              >
                Discard it
              </Button>
            </div>
          </Notice>
        )}
        {guided && script && (
          <section className="rounded-2xl border border-gold-muted/60 bg-card p-4" aria-labelledby="guided-title">
            <h2 id="guided-title" className="font-semibold">
              {guided.dayName} <span className="text-sm font-normal text-muted-foreground">· {guided.programName}</span>
            </h2>
            <p className="text-sm text-muted-foreground">Guided: about {Math.round(scriptSeconds(script) / 60)} minutes including a 5-minute warm-up and cool-down. Cues tell you when to run and walk.</p>
            <ol className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-sm">
              {script.map((p, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{p.label}</span>
                  <span className="tabular-nums text-muted-foreground">{formatHms(p.seconds)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
        {!guided && (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Activity">
            {(["run", "walk"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-2xl border p-4 text-left ${kind === k ? "border-gold bg-gold/10" : "border-border bg-card"}`}
              >
                <span className="block font-display text-xl font-bold uppercase">Outdoor {k}</span>
                <span className="text-xs text-muted-foreground">{k === "run" ? "Distance, pace and splits" : "Distance, pace and your route"}</span>
              </button>
            ))}
          </div>
        )}
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <LocateFixed className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden /> {locationSourceLabel()}.{" "}
            {!hasNativeBackgroundLocation() && "Browsers stop location updates when the screen locks; any time without a signal is kept as a gap, never guessed."}
          </li>
          <li>Location is used only while you record, and your route is private to you.</li>
        </ul>
        {error && <Notice tone="error">{ERROR_TEXT[error]}</Notice>}
        <Button className="w-full" size="lg" onClick={start} data-testid="gps-start">
          <Play aria-hidden /> Start {guided ? "guided run" : kind}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          No GPS? <Link href="/run?tab=log" className="underline">Log a run or walk by hand</Link>.
        </p>
      </div>
    );
  }

  // ------------------------------------------------------------------ Finished: review and save
  if (track.status === "finished") {
    const totals = trackTotals(track);
    return (
      <div className="space-y-4" data-testid="gps-review">
        <h2 className="font-display text-2xl font-bold uppercase">{track.kind === "run" ? "Run" : "Walk"} complete</h2>
        <dl className="grid grid-cols-2 gap-2">
          {(
            [
              ["Distance", formatDistance(totals.distance_m, unit)],
              ["Moving time", formatHms(totals.moving_s)],
              ["Avg pace", formatPace(paceSecondsPer(totals.distance_m, totals.moving_s, unit), unit)],
              ["Total time", formatHms(totals.elapsed_s)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl bg-elevated px-3 py-2">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
              <dd className="font-display text-xl font-bold" data-testid={`review-${label.toLowerCase().replace(/ /g, "-")}`}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {route && <RouteMap coordinates={route.coordinates} className="w-full" />}
        {track.gaps > 0 && (
          <p className="text-sm text-muted-foreground">
            The signal dropped {track.gaps} time{track.gaps === 1 ? "" : "s"}; no distance was added for those stretches.
          </p>
        )}
        <label className="block text-sm">
          How hard was it? (optional)
          <NativeSelect value={effort} onChange={(e) => setEffort(e.target.value)} className="mt-1">
            <option value="">—</option>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} {i === 0 ? "(very easy)" : i === 9 ? "(all out)" : ""}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="block text-sm">
          Notes (optional)
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={2} className="mt-1" />
        </label>
        {saveError && <Notice tone="error">{saveError}</Notice>}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={save} disabled={saving} data-testid="gps-save">
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} Save {track.kind}
          </Button>
          <Button variant="ghost" onClick={discard} disabled={saving}>
            <Trash2 aria-hidden /> Discard
          </Button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ Recording / paused
  return (
    <div className="space-y-4" data-testid="gps-recording">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={track.status === "paused" ? "secondary" : "success"}>{track.status === "acquiring" ? "Waiting for GPS" : track.status === "paused" ? "Paused" : "Recording"}</Badge>
        <span className="text-xs text-muted-foreground" data-testid="gps-accuracy">
          {track.lastAccuracy != null ? `GPS ±${track.lastAccuracy} m` : "No fix yet"}
        </span>
      </div>
      {track.status === "acquiring" && <Notice tone="info">Waiting for a good GPS fix (within 20 m). Time is running; distance starts with the first good fix.</Notice>}
      {track.signalLost && track.status === "recording" && (
        <Notice tone="warning">
          <span className="flex items-center gap-2">
            <SignalZero className="size-4" aria-hidden /> GPS signal lost. Time keeps running; no distance is added until the signal returns.
          </span>
        </Notice>
      )}
      {error && <Notice tone="error">{ERROR_TEXT[error]}</Notice>}

      {phase && (
        <section className="rounded-2xl border border-gold-muted/60 bg-card-gradient p-4 text-center" aria-live="polite" data-testid="guided-phase">
          {phase.phase ? (
            <>
              <p className="font-display text-3xl font-bold uppercase">{phase.phase.label}</p>
              <p className="font-display text-5xl font-bold tabular-nums">{formatHms(phase.remaining)}</p>
              {script && script[phase.index + 1] && <p className="text-sm text-muted-foreground">Next: {script[phase.index + 1]!.label}</p>}
            </>
          ) : (
            <p className="font-display text-2xl font-bold uppercase">Session complete — finish when you&apos;re ready</p>
          )}
          <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={() => setVoice((v) => !v)} aria-pressed={voice}>
            {voice ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />} Voice cues {voice ? "on" : "off"}
          </Button>
        </section>
      )}

      <dl className="grid grid-cols-2 gap-2">
        <div className="col-span-2 rounded-2xl bg-elevated px-4 py-3 text-center">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">Distance</dt>
          <dd className="font-display text-5xl font-bold tabular-nums" data-testid="gps-distance">
            {formatDistance(distance, unit)}
          </dd>
        </div>
        {(
          [
            ["Time", formatHms(elapsed), "gps-elapsed"],
            ["Moving", formatHms(moving), "gps-moving"],
            ["Pace now", formatPace(pace, unit), "gps-pace"],
            ["Avg pace", formatPace(avgPace, unit), "gps-avg-pace"],
          ] as const
        ).map(([label, value, testId]) => (
          <div key={label} className="rounded-xl bg-elevated px-3 py-2 text-center">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="font-display text-2xl font-bold tabular-nums" data-testid={testId}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {route && <RouteMap coordinates={route.coordinates} className="w-full" />}

      {track.splits.length > 0 && (
        <section aria-labelledby="splits-title">
          <h2 id="splits-title" className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
            Splits
          </h2>
          <ol className="mt-1 divide-y divide-border rounded-xl border border-border text-sm">
            {track.splits.map((s) => (
              <li key={s.index} className="flex justify-between px-3 py-1.5 tabular-nums">
                <span>
                  {s.index} {unit}
                </span>
                <span>{formatHms(s.split_s)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] flex gap-2 rounded-2xl border border-border bg-background/95 p-2 backdrop-blur">
        {track.status === "paused" ? (
          <Button
            className="flex-1"
            onClick={async () => {
              setTrack((t) => (t ? resumeTrack(t, Date.now()) : t));
              await beginWatching();
            }}
          >
            <Play aria-hidden /> Resume
          </Button>
        ) : (
          <Button
            className="flex-1"
            variant="secondary"
            onClick={() => {
              stopWatching();
              setTrack((t) => (t ? pauseTrack(t, Date.now()) : t));
            }}
          >
            <Pause aria-hidden /> Pause
          </Button>
        )}
        <Button
          className="flex-1"
          onClick={async () => {
            const ok = await confirmDialog({ title: `Finish this ${track.kind}?`, message: "You'll review it before saving.", confirmLabel: "Finish" });
            if (ok) finish();
          }}
        >
          <Flag aria-hidden /> Finish
        </Button>
        {track.status === "paused" && (
          <Button variant="ghost" size="icon" aria-label="Discard recording" onClick={discard}>
            <Trash2 aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
