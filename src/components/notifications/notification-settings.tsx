"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellOff, BellRing, Loader2, MoonStar, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { isNativeApp } from "@/lib/native";
import { deviceTimeZone, lastSync, notificationPermission, syncReminders, type PermissionState } from "@/lib/native-notifications";
import { FAITH_REMINDER_INFO, WEEKLY_FAITH_KINDS, describeFaithReminder, inQuietHours, type FaithReminder, type FaithReminderKind } from "@/lib/faith-reminders";
import { APP_REMINDER_INFO, WATER_INTERVALS, waterTimes, type AppReminder, type AppReminderKind } from "@/lib/notifications/catalog";
import { DAILY_LIMIT_MAX, DAILY_LIMIT_MIN, planNotifications, type NotificationPrefs, type PlannerContext } from "@/lib/notifications/planner";
import { WEEKDAY_LABELS, reminderMessage, type JsWeekday } from "@/lib/reminders";
import { cn } from "@/lib/utils";
import {
  forgetDeviceAction,
  getNotificationSyncAction,
  saveNotificationSettingsAction,
  setDeviceDeliveryAction,
  setAccountTimeZoneAction,
  type DeviceSummary,
} from "@/server/actions/notifications";
import type { NotificationSettings } from "@/server/services/notifications";

type Status = { tone: "success" | "error"; text: string } | null;
type Cadence = "daily" | "weekly" | "interval";

const FAITH_GROUPS: { title: string; note?: string; kinds: FaithReminderKind[] }[] = [
  { title: "Bible reading and prayer", note: "Not sent once that day's reading or prayer is marked.", kinds: ["reading", "prayer", "accountability"] },
  { title: "Strict reading journey", note: "Only while a strict reading journey is active.", kinds: ["final"] },
  { title: "Faith & Fitness", kinds: ["challenge", "fitness"] },
  { title: "More", kinds: ["devotional", "practices", "memorize", "plan_progress", "prayer_followup"] },
];

const APP_GROUPS: { id: "workouts" | "nutrition" | "recovery"; title: string; note: string; kinds: AppReminderKind[] }[] = [
  { id: "workouts", title: "Workouts", note: "Training reminders. Not sent once today's workout is done.", kinds: ["workout", "plan_week", "weekly_review"] },
  { id: "nutrition", title: "Food & water", note: "Logging nudges only. They never mention calories, weight or amounts.", kinds: ["breakfast", "lunch", "dinner", "snack", "water"] },
  { id: "recovery", title: "Recovery & sleep", note: "Rest days and your evening routine.", kinds: ["recovery", "winddown"] },
];

const fmt12 = (t: string) => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function describe(cadence: Cadence, r: { time: string; weekdays: JsWeekday[] }, water?: AppReminder) {
  if (cadence === "weekly") return `${DAY_NAMES[r.weekdays[0] ?? 0]}s at ${fmt12(r.time)}`;
  if (cadence === "interval" && water) {
    const times = waterTimes(water);
    return `${times.length} a day, ${fmt12(water.time)} to ${fmt12(water.endTime ?? "19:00")}`;
  }
  return describeFaithReminder(r);
}

/** One reminder: on/off, then (when on) its time, days or frequency, and the exact words it shows. */
function ReminderRow({
  id,
  label,
  description,
  cadence,
  value,
  onChange,
  title,
  body,
  quiet,
  children,
}: {
  id: string;
  label: string;
  description: string;
  cadence: Cadence;
  value: { enabled: boolean; time: string; weekdays: JsWeekday[]; intervalMinutes?: number | null; endTime?: string | null };
  onChange: (patch: Partial<{ enabled: boolean; time: string; weekdays: JsWeekday[]; intervalMinutes: number | null; endTime: string | null }>) => void;
  title: string;
  body: string;
  quiet: NotificationPrefs["quiet"];
  children?: React.ReactNode;
}) {
  const sw = `nr-${id}`;
  const toggleDay = (d: JsWeekday) =>
    onChange({ weekdays: value.weekdays.includes(d) ? value.weekdays.filter((x) => x !== d) : [...value.weekdays, d].sort((a, b) => a - b) });
  const asWater = cadence === "interval" ? ({ time: value.time, intervalMinutes: value.intervalMinutes ?? 120, endTime: value.endTime ?? "19:00" } as AppReminder) : undefined;
  return (
    <fieldset className="rounded-xl border border-border p-3" data-reminder={id}>
      <legend className="sr-only">{label} reminder</legend>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={sw} className="block text-[0.9375rem] font-semibold">
            {label}
          </label>
          <p className="text-xs text-muted-foreground">{value.enabled ? describe(cadence, value, asWater) : description}</p>
        </div>
        <Switch id={sw} checked={value.enabled} onCheckedChange={(enabled) => onChange({ enabled })} />
      </div>
      {value.enabled && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="w-36 space-y-1">
              <label htmlFor={`${sw}-time`} className="text-sm font-medium">
                {cadence === "interval" ? "From" : "Time"}
              </label>
              <Input id={`${sw}-time`} type="time" value={value.time} onChange={(e) => onChange({ time: e.target.value })} required />
            </div>
            {cadence === "interval" && (
              <>
                <div className="w-36 space-y-1">
                  <label htmlFor={`${sw}-end`} className="text-sm font-medium">
                    Until
                  </label>
                  <Input id={`${sw}-end`} type="time" value={value.endTime ?? "19:00"} onChange={(e) => onChange({ endTime: e.target.value })} required />
                </div>
                <div className="w-36 space-y-1">
                  <label htmlFor={`${sw}-every`} className="text-sm font-medium">
                    Every
                  </label>
                  <select
                    id={`${sw}-every`}
                    value={value.intervalMinutes ?? 120}
                    onChange={(e) => onChange({ intervalMinutes: Number(e.target.value) })}
                    className="h-11 w-full rounded-lg border border-border bg-elevated px-3 text-sm"
                  >
                    {WATER_INTERVALS.map((m) => (
                      <option key={m} value={m}>
                        {m % 60 === 0 ? `${m / 60} hour${m === 60 ? "" : "s"}` : `${Math.floor(m / 60)}½ hours`}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {cadence === "weekly" && (
              <div className="w-40 space-y-1">
                <label htmlFor={`${sw}-day`} className="text-sm font-medium">
                  Day
                </label>
                <select
                  id={`${sw}-day`}
                  value={value.weekdays[0] ?? 0}
                  onChange={(e) => onChange({ weekdays: [Number(e.target.value) as JsWeekday] })}
                  className="h-11 w-full rounded-lg border border-border bg-elevated px-3 text-sm"
                >
                  {WEEKDAY_LABELS.map((w) => (
                    <option key={w.day} value={w.day}>
                      {w.long}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {cadence !== "weekly" && (
            <div role="group" aria-label={`${label} reminder days`} className="grid grid-cols-7 gap-1">
              {WEEKDAY_LABELS.map((w) => {
                const on = value.weekdays.includes(w.day);
                return (
                  <button
                    key={w.day}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(w.day)}
                    className={cn("min-h-11 rounded-lg border text-xs font-semibold", on ? "border-gold bg-gold/15 text-gold-highlight" : "border-border bg-elevated/50 text-muted-foreground")}
                  >
                    {w.short}
                    <span className="sr-only"> {w.long}</span>
                  </button>
                );
              })}
            </div>
          )}
          {children}
          <p className="text-xs text-muted-foreground">
            Shows: <span className="font-semibold text-foreground">{title}</span> · <span className="italic">{body}</span>
          </p>
          {(cadence === "interval" && asWater ? waterTimes(asWater).every((t) => inQuietHours(t, quiet)) : inQuietHours(value.time, quiet)) && (
            <p className="text-xs text-[#f08a8a]">This time is inside your quiet hours, so this reminder won&rsquo;t be sent.</p>
          )}
        </div>
      )}
    </fieldset>
  );
}

function GroupHeading({ id, title, note }: { id: string; title: string; note?: string }) {
  return (
    <div>
      <h2 id={`${id}-title`} className="font-display text-xl font-bold uppercase tracking-wide text-gold">
        {title}
      </h2>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}

const ago = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 2) return "just now";
  if (min < 60) return `${min} minutes ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
};

/**
 * Profile → Notifications: every optional reminder in one place, grouped Faith / Workouts / Food & water / Recovery
 * & sleep / System. Everything starts off and is turned on one at a time (there is deliberately no "turn all on").
 * Saved to the account; the iPhone / Android app delivers them, and a web browser says plainly that it can't.
 */
export function NotificationSettingsForm({
  initial,
  context,
  timezone,
  devices: initialDevices,
  windDownSuggestion,
}: {
  initial: NotificationSettings;
  context: Omit<PlannerContext, "now" | "deviceTimezone">;
  timezone: string;
  devices: DeviceSummary[];
  windDownSuggestion: string | null;
}) {
  const router = useRouter();
  const [faith, setFaith] = useState(initial.faith);
  const [app, setApp] = useState(initial.app);
  const [prefs, setPrefs] = useState(initial.prefs);
  const [devices, setDevices] = useState(initialDevices);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [native, setNative] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<PermissionState>("unknown");
  const [deviceTz, setDeviceTz] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<number | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const n = isNativeApp();
    setNative(n);
    setDeviceTz(deviceTimeZone());
    setNow(new Date());
    setScheduled(lastSync()?.scheduled ?? null);
    if (n) void notificationPermission().then(setPermission);
  }, []);

  const touch = () => {
    setDirty(true);
    setStatus(null);
  };
  const setF = (kind: FaithReminderKind, patch: Partial<FaithReminder>) => {
    setFaith((l) => l.map((r) => (r.kind === kind ? { ...r, ...patch } : r)));
    touch();
  };
  const setA = (kind: AppReminderKind, patch: Partial<AppReminder>) => {
    setApp((l) => l.map((r) => (r.kind === kind ? { ...r, ...patch } : r)));
    touch();
  };
  const setP = (patch: Partial<NotificationPrefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    touch();
  };

  const onCount = faith.filter((r) => r.enabled).length + app.filter((r) => r.enabled).length;
  const preview = useMemo(
    () => (now ? planNotifications({ faith, app, prefs, ctx: { ...context, now, deviceTimezone: context.timezone }, days: 2, budget: 200 }).filter((n) => !n.at || n.at.getTime() - now.getTime() <= 24 * 3_600_000) : []),
    [faith, app, prefs, context, now],
  );
  const recentDevices = devices.filter((d) => d.delivers && Date.now() - new Date(d.lastSyncAt).getTime() < 14 * 86_400_000);

  const save = async () => {
    const empty = [...faith, ...app].find((r) => r.enabled && r.weekdays.length === 0);
    if (empty) return setStatus({ tone: "error", text: "Pick at least one day for each reminder that's on." });
    const water = app.find((r) => r.kind === "water");
    if (water?.enabled && water.endTime && water.endTime <= water.time) return setStatus({ tone: "error", text: "Water reminders need to end after they start." });
    if (prefs.quiet && prefs.quiet.start === prefs.quiet.end) return setStatus({ tone: "error", text: "Quiet hours need different start and end times." });
    setSaving(true);
    const res = await saveNotificationSettingsAction({ faith, app, prefs });
    if (!res.ok) {
      setSaving(false);
      return setStatus({ tone: "error", text: res.message ?? "Couldn't save your reminders." });
    }
    setDirty(false);
    if (isNativeApp()) {
      const dev = await syncReminders(getNotificationSyncAction, { askPermission: true });
      setPermission(await notificationPermission());
      if (dev.ok) {
        setScheduled(dev.scheduled);
        setStatus({
          tone: "success",
          text: !dev.delivers
            ? "Saved. Reminders are off on this device (see Devices below)."
            : dev.paused
              ? "Saved. All optional reminders are paused."
              : onCount
                ? `Saved. ${dev.scheduled} reminder${dev.scheduled === 1 ? "" : "s"} set on this device.`
                : "Saved. No reminders are on.",
        });
      } else if (dev.reason === "permission-denied") {
        setStatus({ tone: "error", text: "Saved to your account, but notifications are turned off for Narrow Gate Fitness on this device. Allow them in the device's Settings, then save again." });
      } else if (dev.reason === "offline") {
        setStatus({ tone: "error", text: "Saved, but this device couldn't reach your account to update its reminders. They'll update next time it's online." });
      } else setStatus({ tone: "error", text: "Saved to your account, but this device couldn't schedule the notifications. Please try again." });
    } else {
      setStatus({
        tone: "success",
        text: onCount
          ? "Saved to your account. The Narrow Gate Fitness app on your phone delivers them; this browser won't show them."
          : "Saved. No reminders are on.",
      });
    }
    setSaving(false);
    router.refresh();
  };

  const toggleDevice = async (d: DeviceSummary, delivers: boolean) => {
    const res = await setDeviceDeliveryAction(d.id, delivers);
    if (!res.ok) return setStatus({ tone: "error", text: res.message ?? "Couldn't update that device." });
    setDevices((l) => l.map((x) => (x.id === d.id ? { ...x, delivers } : x)));
    if (d.thisDevice && isNativeApp()) {
      const dev = await syncReminders(getNotificationSyncAction);
      if (dev.ok) setScheduled(dev.scheduled);
    }
  };
  const forget = async (d: DeviceSummary) => {
    const res = await forgetDeviceAction(d.id);
    if (res.ok) setDevices((l) => l.filter((x) => x.id !== d.id));
    else setStatus({ tone: "error", text: res.message ?? "Couldn't remove that device." });
  };
  const adoptDeviceTz = async () => {
    if (!deviceTz) return;
    const res = await setAccountTimeZoneAction(deviceTz);
    setStatus(res.ok ? { tone: "success", text: `${res.message} Times below now follow it.` } : { tone: "error", text: res.message ?? "Couldn't update your time zone." });
    if (res.ok) {
      if (isNativeApp()) await syncReminders(getNotificationSyncAction);
      router.refresh();
    }
  };

  const faithRow = (kind: FaithReminderKind) => {
    const r = faith.find((x) => x.kind === kind)!;
    const info = FAITH_REMINDER_INFO[kind];
    return (
      <ReminderRow
        key={kind}
        id={kind}
        label={info.label}
        description={info.description}
        cadence={WEEKLY_FAITH_KINDS.includes(kind) ? "weekly" : "daily"}
        value={r}
        onChange={(p) => setF(kind, p as Partial<FaithReminder>)}
        title={info.title}
        body={info.body}
        quiet={prefs.quiet}
      />
    );
  };
  const appRow = (kind: AppReminderKind) => {
    const r = app.find((x) => x.kind === kind)!;
    const info = APP_REMINDER_INFO[kind];
    const msg = kind === "workout" ? reminderMessage(r.style, ((r.weekdays[0] ?? 1) as JsWeekday), context.faithEnabled) : { title: info.title, body: info.body };
    return (
      <ReminderRow
        key={kind}
        id={kind}
        label={info.label}
        description={info.description}
        cadence={info.cadence}
        value={r}
        onChange={(p) => setA(kind, p as Partial<AppReminder>)}
        title={msg.title}
        body={msg.body}
        quiet={prefs.quiet}
      >
        {kind === "workout" && context.training.hasProgram && <p className="text-xs text-gold-highlight">Following your program&rsquo;s training days; the days above are used if you don&rsquo;t have a program.</p>}
        {kind === "workout" && context.faithEnabled && (
          <div role="radiogroup" aria-label="Workout message style" className="flex flex-wrap gap-2">
            {(["friendly", "faith"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={r.style === s}
                onClick={() => setA("workout", { style: s })}
                className={cn("min-h-11 rounded-lg border px-3 text-sm font-semibold", r.style === s ? "border-gold bg-gold/15 text-gold-highlight" : "border-border bg-elevated/50 text-muted-foreground")}
              >
                {s === "friendly" ? "Friendly" : "Faith-inspired"}
              </button>
            ))}
          </div>
        )}
        {kind === "recovery" && !context.training.hasProgram && <p className="text-xs text-muted-foreground">Without a program, rest days are the days above that aren&rsquo;t workout reminder days.</p>}
        {kind === "winddown" && windDownSuggestion && r.time !== windDownSuggestion && (
          <button type="button" onClick={() => setA("winddown", { time: windDownSuggestion })} className="min-h-11 text-left text-xs font-semibold text-gold-highlight underline">
            Use {fmt12(windDownSuggestion)} (30 minutes before the bedtime your sleep goal suggests)
          </button>
        )}
      </ReminderRow>
    );
  };

  return (
    <div className="space-y-6">
      {/* This device */}
      <section className="space-y-3 rounded-2xl border border-gold-muted bg-card p-4" aria-labelledby="notif-device-title" data-testid="notif-device-status">
        <h2 id="notif-device-title" className="flex items-center gap-2 text-lg font-semibold">
          <Smartphone className="size-5 text-gold" aria-hidden /> This device
        </h2>
        {native === false && (
          <p className="text-sm" data-testid="notif-web-note">
            You&rsquo;re using the web version. Your choices are saved to your account, and the Narrow Gate Fitness app for iPhone and Android delivers them, even when
            the app is closed. A web browser can&rsquo;t remind you while this site is closed.
          </p>
        )}
        {native && (
          <dl className="grid gap-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Notifications</dt>
              <dd className={cn("font-semibold", permission === "granted" ? "text-[#5fc49a]" : permission === "denied" ? "text-[#f08a8a]" : "")} data-testid="notif-permission">
                {permission === "granted" ? "Allowed" : permission === "denied" ? "Not allowed" : "Not asked yet"}
              </dd>
            </div>
            {scheduled !== null && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Scheduled on this device</dt>
                <dd className="font-semibold">{scheduled}</dd>
              </div>
            )}
          </dl>
        )}
        {native && permission === "denied" && (
          <p className="text-sm text-[#f08a8a]">Notifications are off for Narrow Gate Fitness. To get reminders, allow them in your device&rsquo;s Settings app under Notifications.</p>
        )}
        <p className="text-sm text-muted-foreground">
          Times follow your account&rsquo;s time zone, <span className="font-semibold text-foreground">{timezone}</span> (the same clock as your reading journey&rsquo;s day).
        </p>
        {deviceTz && deviceTz !== timezone && (
          <div className="rounded-xl border border-gold-muted/60 bg-gold/5 p-3 text-sm" data-testid="notif-tz-mismatch">
            <p>
              This device is set to <span className="font-semibold">{deviceTz}</span>. If you&rsquo;ve moved or are travelling, use its time zone so reminders and your
              journey&rsquo;s day follow your local time.
            </p>
            <Button variant="secondary" className="mt-2" onClick={adoptDeviceTz}>
              Use {deviceTz}
            </Button>
          </div>
        )}
      </section>

      {/* Pause all optional */}
      <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="notif-pause-label">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div className="min-w-0">
            <label id="notif-pause-label" htmlFor="notif-paused" className="flex items-center gap-2 font-semibold">
              <BellOff className="size-4 text-gold" aria-hidden /> Pause all optional reminders
            </label>
            <p className="text-xs text-muted-foreground">
              {prefs.paused ? "Paused. Nothing is sent until you turn this off; your choices below are kept." : "Stops every reminder below at once, without losing your choices."}
            </p>
          </div>
          <Switch id="notif-paused" checked={prefs.paused} onCheckedChange={(paused) => setP({ paused })} />
        </div>
      </section>

      <div className={cn("space-y-6", prefs.paused && "opacity-60")}>
        <section id="faith" className="scroll-mt-20 space-y-4" aria-labelledby="faith-title">
          <GroupHeading id="faith" title="Faith" note="Gentle nudges, never streak warnings. Always free." />
          {FAITH_GROUPS.map((g) => (
            <div key={g.title} className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gold">{g.title}</h3>
                {g.note && <p className="text-xs text-muted-foreground">{g.note}</p>}
              </div>
              {g.kinds.map(faithRow)}
            </div>
          ))}
        </section>

        {APP_GROUPS.map((g) => (
          <section key={g.id} id={g.id} className="scroll-mt-20 space-y-3" aria-labelledby={`${g.id}-title`}>
            <GroupHeading id={g.id} title={g.title} note={g.note} />
            {g.kinds.map(appRow)}
          </section>
        ))}
      </div>

      {/* System */}
      <section id="system" className="scroll-mt-20 space-y-3" aria-labelledby="system-title">
        <GroupHeading id="system" title="System" />
        <fieldset className="rounded-xl border border-border p-3">
          <legend className="sr-only">Quiet hours</legend>
          <div className="flex min-h-11 items-center justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor="notif-quiet" className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                <MoonStar className="size-4 text-gold" aria-hidden /> Quiet hours
              </label>
              <p className="text-xs text-muted-foreground">{prefs.quiet ? `No reminders from ${fmt12(prefs.quiet.start)} to ${fmt12(prefs.quiet.end)}.` : "Choose times when no reminder is sent."}</p>
            </div>
            <Switch id="notif-quiet" checked={Boolean(prefs.quiet)} onCheckedChange={(on) => setP({ quiet: on ? { start: "22:00", end: "07:00" } : null })} />
          </div>
          {prefs.quiet && (
            <div className="mt-3 grid max-w-xs grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="notif-quiet-start" className="text-sm font-medium">
                  From
                </label>
                <Input id="notif-quiet-start" type="time" value={prefs.quiet.start} onChange={(e) => setP({ quiet: { ...prefs.quiet!, start: e.target.value } })} required />
              </div>
              <div className="space-y-1">
                <label htmlFor="notif-quiet-end" className="text-sm font-medium">
                  To
                </label>
                <Input id="notif-quiet-end" type="time" value={prefs.quiet.end} onChange={(e) => setP({ quiet: { ...prefs.quiet!, end: e.target.value } })} required />
              </div>
            </div>
          )}
        </fieldset>

        <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div className="min-w-0">
            <label htmlFor="notif-limit" className="block text-[0.9375rem] font-semibold">
              Daily limit
            </label>
            <p className="text-xs text-muted-foreground">On a busy day, the most important reminders are kept and the rest are skipped.</p>
          </div>
          <select
            id="notif-limit"
            value={prefs.dailyLimit}
            onChange={(e) => setP({ dailyLimit: Number(e.target.value) })}
            className="h-11 w-24 shrink-0 rounded-lg border border-border bg-elevated px-3 text-sm"
          >
            {Array.from({ length: DAILY_LIMIT_MAX - DAILY_LIMIT_MIN + 1 }, (_, i) => i + DAILY_LIMIT_MIN).map((n) => (
              <option key={n} value={n}>
                {n} a day
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-border p-3" data-testid="notif-preview">
          <p className="flex items-center gap-2 text-[0.9375rem] font-semibold">
            <BellRing className="size-4 text-gold" aria-hidden /> Next 24 hours
          </p>
          {preview.length === 0 ? (
            <p className="text-xs text-muted-foreground">{prefs.paused ? "Paused: nothing will be sent." : onCount ? "Nothing is due in the next 24 hours." : "No reminders are on."}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {preview.slice(0, 12).map((n) => (
                <li key={n.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{n.title}</span>
                  <span className="shrink-0 text-muted-foreground">{n.date === context.today ? "Today" : n.date ? "Tomorrow" : "Weekly"} {fmt12(n.time)}</span>
                </li>
              ))}
            </ul>
          )}
          {dirty && <p className="mt-2 text-xs text-muted-foreground">Includes changes you haven&rsquo;t saved yet.</p>}
        </div>

        <div className="rounded-xl border border-border p-3" data-testid="notif-devices">
          <p className="text-[0.9375rem] font-semibold">Devices</p>
          {devices.length === 0 ? (
            <p className="text-xs text-muted-foreground">No phone has connected yet. Sign in to the Narrow Gate Fitness app on your phone and it will appear here.</p>
          ) : (
            <>
              {recentDevices.length > 1 && <p className="text-xs text-gold-highlight">Reminders go to each device that&rsquo;s on. Turn off the ones you don&rsquo;t want them on, so you don&rsquo;t get each one twice.</p>}
              <ul className="mt-2 divide-y divide-border">
                {devices.map((d) => (
                  <li key={d.id} className="flex min-h-14 items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`dev-${d.id}`} className="block text-sm font-semibold">
                        {d.label}
                        {d.thisDevice ? " (this device)" : ""}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Last connected {ago(d.lastSyncAt)}
                        {d.permission === "denied" ? " · notifications not allowed" : ""}
                      </p>
                    </div>
                    <Switch id={`dev-${d.id}`} checked={d.delivers} onCheckedChange={(v) => void toggleDevice(d, v)} />
                    {!d.thisDevice && (
                      <button type="button" onClick={() => void forget(d)} aria-label={`Remove ${d.label}`} className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:text-foreground">
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-border p-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="size-4 text-gold" aria-hidden /> Privacy
          </p>
          <p>Reminders only say what&rsquo;s ready. They never show your prayers, journal, notes, meals, weight, sleep or other health details, so nothing private appears on your lock screen.</p>
          <p>Narrow Gate Fitness doesn&rsquo;t send marketing or promotional notifications.</p>
          <p>
            Separate from these: the rest-timer alert during a workout, and your wake-up alarm, which you set under{" "}
            <Link href="/progress/sleep" className="font-semibold text-gold-highlight underline">
              Sleep
            </Link>
            . Pausing reminders doesn&rsquo;t change them.
          </p>
        </div>
      </section>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 space-y-2 rounded-2xl border border-gold-muted bg-[#0b0b0b]/95 p-3 backdrop-blur md:bottom-4">
        {status && (
          <p role={status.tone === "success" ? "status" : "alert"} className={cn("text-sm", status.tone === "success" ? "text-[#5fc49a]" : "text-[#f08a8a]")}>
            {status.text}
          </p>
        )}
        <Button className="w-full" onClick={save} disabled={saving} aria-busy={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {dirty ? "Save changes" : "Save reminders"}
        </Button>
      </div>
    </div>
  );
}
