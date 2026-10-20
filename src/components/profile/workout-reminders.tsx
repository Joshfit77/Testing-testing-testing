"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isNativeApp } from "@/lib/native";
import { cancelWorkoutReminders, pendingWorkoutReminderCount, scheduleWorkoutReminders } from "@/lib/native-reminders";
import {
  DEFAULT_REMINDER_SETTINGS,
  WEEKDAY_LABELS,
  describeSchedule,
  loadReminderSettings,
  parseTime,
  reminderMessage,
  saveReminderSettings,
  type JsWeekday,
  type ReminderSettings,
} from "@/lib/reminders";
import { cn } from "@/lib/utils";

type Mode = "loading" | "native" | "web";
type Status = { tone: "success" | "error"; text: string } | null;

export function WorkoutReminders({ faithEnabled }: { faithEnabled: boolean }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [pending, setPending] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    if (!isNativeApp()) {
      setMode("web");
      return;
    }
    setMode("native");
    setSettings(loadReminderSettings());
    void pendingWorkoutReminderCount().then(setPending);
  }, []);

  const update = (patch: Partial<ReminderSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setStatus(null);
  };

  const toggleDay = (day: JsWeekday) =>
    update({ weekdays: settings.weekdays.includes(day) ? settings.weekdays.filter((d) => d !== day) : [...settings.weekdays, day] });

  const save = async () => {
    if (settings.enabled && settings.weekdays.length === 0) return setStatus({ tone: "error", text: "Pick at least one day." });
    if (settings.enabled && !parseTime(settings.time)) return setStatus({ tone: "error", text: "Choose a reminder time." });
    setSaving(true);
    const res = settings.enabled ? await scheduleWorkoutReminders(settings, faithEnabled) : await cancelWorkoutReminders();
    if (res.ok) {
      saveReminderSettings(settings);
      setStatus({
        tone: "success",
        text: settings.enabled ? `Reminders set for ${describeSchedule(settings)} on this device.` : "Workout reminders are off on this device.",
      });
    } else if (res.reason === "permission-denied") {
      setStatus({ tone: "error", text: "Notifications are turned off for Narrow Gate Fitness. Allow them in your device's Settings, then save again." });
    } else {
      setStatus({ tone: "error", text: "Couldn't update reminders on this device. Please try again." });
    }
    setPending(await pendingWorkoutReminderCount());
    setSaving(false);
  };

  const preview = settings.weekdays[0] ?? 1;

  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="reminders-title">
      <h2 id="reminders-title" className="flex items-center gap-2 font-display text-xl font-bold uppercase">
        <BellRing className="size-5 text-gold" aria-hidden /> Workout reminders
      </h2>

      {mode === "loading" && <p className="mt-2 text-sm text-muted-foreground">Checking this device…</p>}

      {mode === "web" && (
        <div className="mt-3 flex gap-3 rounded-xl border border-gold-muted/50 bg-gold/5 p-4 text-sm">
          <Smartphone className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
          <p>
            Workout reminders work in the Narrow Gate Fitness app for iPhone and Android, where they&apos;re delivered even when the app is closed. Open{" "}
            <strong>Profile &amp; Settings</strong> in the app to choose your days and time. They aren&apos;t available in a web browser.
          </p>
        </div>
      )}

      {mode === "native" && (
        <div className="mt-3 space-y-5">
          <p className="text-sm text-muted-foreground">Weekly reminders on this device. Settings are saved on this phone only.</p>

          <div className="flex min-h-11 items-center justify-between gap-4">
            <Label htmlFor="reminders-enabled" className="text-sm font-semibold">
              Remind me to train
            </Label>
            <Switch id="reminders-enabled" checked={settings.enabled} onCheckedChange={(enabled) => update({ enabled })} />
          </div>

          <fieldset disabled={!settings.enabled} className="space-y-5 disabled:opacity-50">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Days</legend>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_LABELS.map((w) => {
                  const on = settings.weekdays.includes(w.day);
                  return (
                    <button
                      key={w.day}
                      type="button"
                      aria-pressed={on}
                      aria-label={w.long}
                      onClick={() => toggleDay(w.day)}
                      className={cn(
                        "min-h-11 rounded-xl border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-highlight",
                        on ? "border-gold bg-gold/15 text-gold-highlight" : "border-border bg-elevated/50 text-muted-foreground",
                      )}
                    >
                      {w.short}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="max-w-40 space-y-1">
              <Label htmlFor="reminders-time">Time</Label>
              <Input id="reminders-time" type="time" value={settings.time} onChange={(e) => update({ time: e.target.value })} required />
            </div>

            <div>
              <p id="reminders-style" className="mb-2 text-sm font-semibold">
                Message style
              </p>
              <div role="radiogroup" aria-labelledby="reminders-style" className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { value: "friendly", label: "Friendly", show: true },
                    { value: "faith", label: "Faith-inspired", show: faithEnabled },
                  ] as const
                )
                  .filter((o) => o.show)
                  .map((o) => {
                    const checked = settings.style === o.value || (o.value === "friendly" && !faithEnabled);
                    return (
                      <label
                        key={o.value}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2",
                          checked ? "border-gold bg-gold/10" : "border-border bg-elevated/50",
                        )}
                      >
                        <input
                          type="radio"
                          name="reminder-style"
                          value={o.value}
                          checked={checked}
                          onChange={() => update({ style: o.value })}
                          className="mt-1 size-4 accent-[#C9A54C]"
                        />
                        <span className="text-sm">
                          <span className="block font-semibold">{o.label}</span>
                          <span className="block text-xs text-muted-foreground">&ldquo;{reminderMessage(o.value, preview, faithEnabled).body}&rdquo;</span>
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>
          </fieldset>

          {status && (
            <p role={status.tone === "success" ? "status" : "alert"} className={status.tone === "success" ? "text-sm text-[#5fc49a]" : "text-sm text-[#f08a8a]"}>
              {status.text}
            </p>
          )}
          {pending !== null && (
            <p className="text-xs text-muted-foreground">
              {pending === 0 ? "No workout reminders are scheduled on this device." : `${pending} weekly reminder${pending === 1 ? "" : "s"} scheduled on this device.`}
            </p>
          )}

          <Button onClick={save} disabled={saving} aria-busy={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            Save reminders
          </Button>
        </div>
      )}
    </section>
  );
}
