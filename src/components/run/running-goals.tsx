"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Plus, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseDuration, type DistanceUnit } from "@/lib/domain/activities";
import { addRunningGoalAction, removeRunningGoalAction } from "@/server/actions/gps-activities";

export interface GoalView {
  id: string;
  title: string;
  detail: string;
  pct: number | null;
  met: boolean;
}

const RACES = [
  { meters: 1609.344, label: "1 mile" },
  { meters: 5000, label: "5K" },
  { meters: 10000, label: "10K" },
  { meters: 21097.5, label: "Half marathon" },
];

export function RunningGoals({ goals, unit }: { goals: GoalView[]; unit: DistanceUnit }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"weekly_distance" | "monthly_distance" | "race_time">("weekly_distance");
  const [distance, setDistance] = useState("");
  const [race, setRace] = useState("5000");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      setMessage(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) {
        setDistance("");
        setTime("");
        router.refresh();
      }
    });

  return (
    <div className="space-y-3">
      {goals.length > 0 ? (
        <ul className="space-y-2" data-testid="run-goals">
          {goals.map((g) => (
            <li key={g.id} className="rounded-xl bg-elevated px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {g.title} {g.met && <span className="text-[#5fc49a]">✓</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{g.detail}</p>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={`Remove goal: ${g.title}`} disabled={pending} onClick={() => run(() => removeRunningGoalAction(g.id))}>
                  <Trash2 aria-hidden />
                </Button>
              </div>
              {g.pct != null && (
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-background" role="img" aria-label={`${g.pct}% of the goal`}>
                  <div className="h-full rounded-full bg-gold" style={{ width: `${g.pct}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No goals yet. Set a weekly distance or a target time.</p>
      )}
      <form
        className="grid gap-2 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (kind === "race_time") {
            const secs = parseDuration(time);
            if (!secs) return setMessage({ ok: false, text: "Enter a target time like 28:00." });
            run(() => addRunningGoalAction({ kind, raceMeters: Number(race), targetSeconds: secs }));
          } else {
            run(() => addRunningGoalAction({ kind, distance: Number(distance), unit }));
          }
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="goal-kind">Goal</Label>
          <NativeSelect id="goal-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="weekly_distance">Weekly distance</option>
            <option value="monthly_distance">Monthly distance</option>
            <option value="race_time">Target time</option>
          </NativeSelect>
        </div>
        {kind === "race_time" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="goal-race">Race</Label>
              <NativeSelect id="goal-race" value={race} onChange={(e) => setRace(e.target.value)}>
                {RACES.map((r) => (
                  <option key={r.label} value={r.meters}>
                    {r.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="goal-time">Target time</Label>
              <Input id="goal-time" value={time} onChange={(e) => setTime(e.target.value)} placeholder="28:00" inputMode="numeric" />
            </div>
          </>
        ) : (
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="goal-distance">Goal distance ({unit})</Label>
            <Input id="goal-distance" type="number" inputMode="decimal" step="0.1" min="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} required />
          </div>
        )}
        <div className="sm:col-span-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />} Add goal
          </Button>
        </div>
      </form>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-[#5fc49a]" : "text-sm text-[#f08a8a]"}>
          <Target className="mr-1 inline size-3.5" aria-hidden />
          {message.text}
        </p>
      )}
    </div>
  );
}
