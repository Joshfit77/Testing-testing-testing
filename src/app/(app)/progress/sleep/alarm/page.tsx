import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { SleepAlarmForm } from "@/components/sleep/alarm-form";
import { ALARM_HONESTY, describeAlarm, parseAlarmConfig, upcomingAlarms } from "@/lib/domain/sleep-alarm";
import { requireOnboardedUser } from "@/server/auth";

export const metadata = { title: "Wake-up alarm" };

export default async function SleepAlarmPage() {
  const { profile } = await requireOnboardedUser();
  const tz = profile.timezone ?? "UTC";
  const config = parseAlarmConfig(profile.sleep_alarm);
  const next = upcomingAlarms(config, new Date(), tz);
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });
  const card = "rounded-2xl border border-border bg-card p-5";

  return (
    <div className="space-y-6">
      <BackLink href="/progress/sleep">Sleep & Recovery</BackLink>
      <PageHeader eyebrow="Sleep & Recovery" title="Wake-up alarm" description={config.enabled ? describeAlarm(config) : "Off"} />

      <section className={card} aria-labelledby="alarm-title">
        <h2 id="alarm-title" className="font-display text-xl font-bold uppercase">
          Alarm
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">A repeating alarm at a fixed time on the days you choose, with Snooze and an I&apos;m up button that opens your morning check-in.</p>
        <SleepAlarmForm config={config} />
      </section>

      <section className={card} aria-labelledby="next-title">
        <h2 id="next-title" className="font-display text-xl font-bold uppercase">
          Next alarms
        </h2>
        {next.length ? (
          <ul className="mt-2 divide-y divide-border text-sm" aria-label="Next alarms">
            {next.map((iso) => (
              <li key={iso} className="py-2">
                {when(iso)}
              </li>
            ))}
          </ul>
        ) : (
          <Notice className="mt-2">{config.enabled ? "No days chosen, so nothing is scheduled." : "The alarm is off."}</Notice>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Times in {tz.replace(/_/g, " ")}, your profile time zone.</p>
      </section>

      <section className={card} aria-labelledby="honesty-title">
        <h2 id="honesty-title" className="font-display text-xl font-bold uppercase">
          What to expect
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {ALARM_HONESTY.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
