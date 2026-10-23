"use client";

import { useActionState, useEffect, useState } from "react";
import { AlarmClock, Smartphone } from "lucide-react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { NativeSelect, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { alarmConfigFromForm, alarmConfigSchema, SNOOZE_OPTIONS, WEEKDAY_LABELS, WEEKDAYS, type AlarmConfig } from "@/lib/domain/sleep-alarm";
import { isNativeApp } from "@/lib/native";
import { cancelSleepAlarm, pendingSleepAlarmCount, requestExactAlarms, scheduleSleepAlarm } from "@/lib/native-alarm";
import { setSleepAlarmAction } from "@/server/actions/sleep";
import { cn } from "@/lib/utils";

type Device = "checking" | "phone" | "web";
type DeviceStatus = { tone: "ok" | "warn" | "error"; text: string } | null;

/**
 * Saves the alarm to the member's account, then (in the phone app) schedules it on this device and reports
 * exactly what the device accepted. On the web the settings are saved and the page says where they take effect.
 */
export function SleepAlarmForm({ config }: { config: AlarmConfig }) {
  const [device, setDevice] = useState<Device>("checking");
  const [enabled, setEnabled] = useState(config.enabled);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(null);
  useEffect(() => {
    const native = isNativeApp();
    setDevice(native ? "phone" : "web");
    if (native) void pendingSleepAlarmCount().then(setPendingCount);
  }, []);

  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const res = await setSleepAlarmAction(prev, form);
    if (!res.ok || !isNativeApp()) return res;
    const parsed = alarmConfigSchema.safeParse(alarmConfigFromForm(form, config));
    const next = parsed.success ? parsed.data : null;
    const scheduled = next?.enabled ? await scheduleSleepAlarm(next) : await cancelSleepAlarm();
    if (scheduled.ok) {
      setDeviceStatus(
        !next?.enabled || scheduled.scheduled === 0
          ? { tone: "ok", text: "No alarm is scheduled on this phone." }
          : scheduled.exact
            ? { tone: "ok", text: `${scheduled.scheduled} weekly alarm${scheduled.scheduled === 1 ? "" : "s"} scheduled on this phone.` }
            : { tone: "warn", text: `${scheduled.scheduled} weekly alarm${scheduled.scheduled === 1 ? "" : "s"} scheduled, but Android may sound them a few minutes late until "Alarms & reminders" is allowed for Narrow Gate.` },
      );
    } else if (scheduled.reason === "permission-denied") {
      setDeviceStatus({ tone: "error", text: "Saved, but notifications are turned off for Narrow Gate on this phone, so the alarm can't sound. Allow them in Settings, then save again." });
    } else {
      setDeviceStatus({ tone: "error", text: "Saved, but this phone didn't accept the alarm. Please try again." });
    }
    setPendingCount(await pendingSleepAlarmCount());
    return res;
  }, initialActionState);

  return (
    <form action={action} className="space-y-5">
      <div className="flex min-h-11 items-center justify-between gap-4">
        <Label htmlFor="alarm-enabled" className="flex items-center gap-2 text-sm font-semibold">
          <AlarmClock className="size-4 text-gold" aria-hidden /> Wake me up
        </Label>
        <Switch id="alarm-enabled" name="enabled" checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <fieldset disabled={!enabled} className="space-y-5 disabled:opacity-50">
        <div className="max-w-40 space-y-1.5">
          <Label htmlFor="alarm-time">Wake time</Label>
          <Input id="alarm-time" name="wakeTime" type="time" defaultValue={config.wakeTime} required aria-invalid={Boolean(state.fieldErrors?.wakeTime)} />
          <FieldError message={state.fieldErrors?.wakeTime} />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Days</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d) => (
              <label key={d} className="relative">
                <input type="checkbox" name="days" value={d} defaultChecked={config.days.includes(d)} className="peer sr-only" />
                <span
                  aria-hidden
                  className={cn(
                    "flex min-h-11 items-center justify-center rounded-xl border border-border bg-elevated/50 text-xs font-semibold text-muted-foreground transition-colors",
                    "peer-checked:border-gold peer-checked:bg-gold/15 peer-checked:text-gold-highlight peer-focus-visible:ring-2 peer-focus-visible:ring-gold-highlight",
                  )}
                >
                  {WEEKDAY_LABELS[d].short}
                </span>
                <span className="sr-only">{WEEKDAY_LABELS[d].long}</span>
              </label>
            ))}
          </div>
          <FieldError message={state.fieldErrors?.days} />
        </fieldset>

        <div className="max-w-48 space-y-1.5">
          <Label htmlFor="alarm-snooze">Snooze</Label>
          <NativeSelect id="alarm-snooze" name="snoozeMinutes" defaultValue={String(config.snoozeMinutes)}>
            {SNOOZE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </NativeSelect>
        </div>
      </fieldset>

      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">Save alarm</SubmitButton>

      {device === "web" && (
        <div className="flex gap-3 rounded-xl border border-gold-muted/50 bg-gold/5 p-4 text-sm">
          <Smartphone className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
          <p>These settings are saved to your account. The alarm itself sounds from the Narrow Gate phone app, which schedules it on your phone; a web browser can&apos;t wake you.</p>
        </div>
      )}
      {device === "phone" && (
        <div className="space-y-2 text-sm">
          {deviceStatus && (
            <p role={deviceStatus.tone === "error" ? "alert" : "status"} className={deviceStatus.tone === "ok" ? "text-[#5fc49a]" : deviceStatus.tone === "warn" ? "text-gold-highlight" : "text-[#f08a8a]"}>
              {deviceStatus.text}
            </p>
          )}
          {pendingCount !== null && !deviceStatus && (
            <p className="text-muted-foreground">{pendingCount === 0 ? "No alarm is scheduled on this phone yet. Save to schedule it." : `${pendingCount} alarm notification${pendingCount === 1 ? "" : "s"} pending on this phone.`}</p>
          )}
          {deviceStatus?.tone === "warn" && (
            <button type="button" className="text-sm font-semibold text-gold-highlight underline" onClick={() => void requestExactAlarms().then((ok) => ok && setDeviceStatus({ tone: "ok", text: "Exact alarms allowed. Save again to reschedule at the exact minute." }))}>
              Allow exact alarms
            </button>
          )}
        </div>
      )}
    </form>
  );
}
