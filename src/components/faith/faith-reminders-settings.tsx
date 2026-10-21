"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { isNativeApp } from "@/lib/native";
import { syncFaithReminders } from "@/lib/native-reminders";
import { FAITH_REMINDER_INFO, describeFaithReminder, type FaithReminder } from "@/lib/faith-reminders";
import { WEEKDAY_LABELS, type JsWeekday } from "@/lib/reminders";
import { cn } from "@/lib/utils";
import { saveFaithRemindersAction } from "@/server/actions/faith";

type Status = { tone: "success" | "error"; text: string } | null;

/**
 * Devotional, prayer and practice reminders. Off by default. Settings are saved to the account; the
 * iPhone/Android app turns them into local notifications. A browser can't, and this says so plainly.
 */
export function FaithRemindersSettings({ initial }: { initial: FaithReminder[] }) {
  const [list, setList] = useState<FaithReminder[]>(initial);
  const [native, setNative] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  useEffect(() => setNative(isNativeApp()), []);

  const update = (kind: FaithReminder["kind"], patch: Partial<FaithReminder>) => {
    setList((l) => l.map((r) => (r.kind === kind ? { ...r, ...patch } : r)));
    setStatus(null);
  };
  const toggleDay = (r: FaithReminder, d: JsWeekday) =>
    update(r.kind, { weekdays: r.weekdays.includes(d) ? r.weekdays.filter((x) => x !== d) : [...r.weekdays, d].sort((a, b) => a - b) });

  const save = async () => {
    const empty = list.find((r) => r.enabled && r.weekdays.length === 0);
    if (empty) return setStatus({ tone: "error", text: `Pick at least one day for the ${FAITH_REMINDER_INFO[empty.kind].label.toLowerCase()} reminder.` });
    setSaving(true);
    const res = await saveFaithRemindersAction(list);
    if (!res.ok) {
      setSaving(false);
      return setStatus({ tone: "error", text: res.message ?? "Couldn't save your reminders." });
    }
    const on = list.filter((r) => r.enabled);
    if (isNativeApp()) {
      const dev = await syncFaithReminders(res.reminders ?? list, { askPermission: true });
      if (dev.ok) setStatus({ tone: "success", text: on.length ? `Saved. ${dev.scheduled} weekly notification${dev.scheduled === 1 ? "" : "s"} set on this device.` : "Saved. Faith reminders are off on this device." });
      else if (dev.reason === "permission-denied")
        setStatus({ tone: "error", text: "Saved to your account, but notifications are turned off for Narrow Gate Fitness. Allow them in your device's Settings, then save again." });
      else setStatus({ tone: "error", text: "Saved to your account, but this device couldn't schedule the notifications. Please try again." });
    } else {
      setStatus({
        tone: "success",
        text: on.length
          ? "Saved to your account. They'll be delivered by the Narrow Gate Fitness app on your phone; this browser won't show them."
          : "Saved. Faith reminders are off.",
      });
    }
    setSaving(false);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="faith-reminders-title">
      <h2 id="faith-reminders-title" className="flex items-center gap-2 text-lg font-semibold">
        <BellRing className="size-5 text-gold" aria-hidden /> Devotional, prayer and practices
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Optional and off unless you turn them on. Gentle nudges, never streak warnings.</p>

      {native === false && (
        <div className="mt-3 flex gap-3 rounded-xl border border-gold-muted/50 bg-gold/5 p-3 text-sm" data-testid="reminders-web-note">
          <Smartphone className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
          <p>
            You&apos;re using the web version. Your choices are saved to your account, but notifications are only delivered by the Narrow Gate Fitness app for
            iPhone and Android (even when the app is closed). A web browser can&apos;t remind you while this site is closed.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {list.map((r) => {
          const info = FAITH_REMINDER_INFO[r.kind];
          const sw = `fr-${r.kind}`;
          return (
            <fieldset key={r.kind} className="rounded-xl border border-border p-3">
              <legend className="sr-only">{info.label} reminder</legend>
              <div className="flex min-h-11 items-center justify-between gap-3">
                <div className="min-w-0">
                  <label htmlFor={sw} className="block text-[0.9375rem] font-semibold">
                    {info.label} reminder
                  </label>
                  <p className="text-xs text-muted-foreground">{r.enabled ? describeFaithReminder(r) : info.description}</p>
                </div>
                <Switch id={sw} checked={r.enabled} onCheckedChange={(enabled) => update(r.kind, { enabled })} />
              </div>
              {r.enabled && (
                <div className="mt-3 space-y-3">
                  <div className="max-w-40 space-y-1">
                    <label htmlFor={`${sw}-time`} className="text-sm font-medium">
                      Time
                    </label>
                    <Input id={`${sw}-time`} type="time" value={r.time} onChange={(e) => update(r.kind, { time: e.target.value })} required />
                  </div>
                  <div role="group" aria-label={`${info.label} reminder days`} className="grid grid-cols-7 gap-1">
                    {WEEKDAY_LABELS.map((w) => {
                      const on = r.weekdays.includes(w.day);
                      return (
                        <button
                          key={w.day}
                          type="button"
                          aria-pressed={on}
                          aria-label={w.long}
                          onClick={() => toggleDay(r, w.day)}
                          className={cn(
                            "min-h-11 rounded-lg border text-xs font-semibold",
                            on ? "border-gold bg-gold/15 text-gold-highlight" : "border-border bg-elevated/50 text-muted-foreground",
                          )}
                        >
                          {w.short.slice(0, 2)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Message: <span className="italic">{info.body}</span>
                  </p>
                </div>
              )}
            </fieldset>
          );
        })}
      </div>

      {status && (
        <p role={status.tone === "success" ? "status" : "alert"} className={cn("mt-3 text-sm", status.tone === "success" ? "text-[#5fc49a]" : "text-[#f08a8a]")}>
          {status.text}
        </p>
      )}
      <Button className="mt-3 w-full" onClick={save} disabled={saving} aria-busy={saving}>
        {saving && <Loader2 className="animate-spin" aria-hidden />}
        Save reminders
      </Button>
    </section>
  );
}

/**
 * Inside the iPhone/Android app: re-applies the account's faith reminders on this device once per app
 * session (so settings saved on another device take effect here). Does nothing in a browser and never
 * prompts for permission on its own.
 */
export function FaithReminderSync({ load }: { load: () => Promise<FaithReminder[]> }) {
  useEffect(() => {
    if (!isNativeApp()) return;
    try {
      if (sessionStorage.getItem("ngf.faithRemindersSynced") === "1") return;
      sessionStorage.setItem("ngf.faithRemindersSynced", "1");
    } catch {
      /* storage unavailable: sync anyway */
    }
    void load()
      .then((r) => syncFaithReminders(r))
      .catch(() => undefined);
  }, [load]);
  return null;
}
