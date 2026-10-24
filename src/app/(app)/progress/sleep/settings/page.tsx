import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { SleepGoalForm } from "@/components/sleep/goal-form";
import { SleepImportCard } from "@/components/sleep/import-card";
import { DEFAULT_SLEEP_GOAL_MINUTES, formatDuration } from "@/lib/domain/sleep";
import { IMPORT_SOURCE_LABEL } from "@/lib/domain/sleep-import";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { deleteAllSleepDataAction } from "@/server/actions/sleep";
import { deleteImportedSleepAction, disconnectSleepSourceAction, setSleepImportEnabledAction } from "@/server/actions/sleep-import";
import { listSleepImportRuns } from "@/server/services/sleep";

export const metadata = { title: "Sleep settings" };

export default async function SleepSettingsPage() {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [{ count, error: countError }, { count: importedCount, error: importedError }, runs] = await Promise.all([
    supabase.from("sleep_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("sleep_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("source", ["apple_health", "health_connect", "wearable"]),
    listSleepImportRuns(supabase, user.id, 5).catch(() => []),
  ]);
  const importEnabled = profile.sleep_import_enabled ?? true;
  const goal = profile.sleep_goal_minutes ?? DEFAULT_SLEEP_GOAL_MINUTES;
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: profile.timezone ?? "UTC" });
  const card = "rounded-2xl border border-border bg-card p-5";
  const consentedOn = profile.wellness_consent_at ? new Date(profile.wellness_consent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div className="space-y-6">
      <BackLink href="/progress/sleep">Sleep & Recovery</BackLink>
      <PageHeader eyebrow="Sleep & Recovery" title="Sleep settings" description="Your goal, and what is stored." />

      <section className={card} aria-labelledby="goal-title">
        <h2 id="goal-title" className="font-display text-xl font-bold uppercase">
          Sleep goal
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Currently {formatDuration(goal)}. Public-health guidance for most adults is 7 hours or more; this is a target you choose, not a measurement of what your body needs. Nightly scores and goal completion use it.
        </p>
        <SleepGoalForm goalMinutes={goal} />
      </section>

      <section id="devices" className={card} aria-labelledby="devices-title">
        <h2 id="devices-title" className="font-display text-xl font-bold uppercase">
          Connected devices
        </h2>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="sleep-connection">
          {profile.sleep_import_source
            ? `Connected to ${IMPORT_SOURCE_LABEL[profile.sleep_import_source]}${profile.sleep_import_connected_at ? ` since ${when(profile.sleep_import_connected_at)}` : ""}${runs[0]?.device ? ` · ${runs[0].device}` : ""}.`
            : "Not connected. Any watch or ring that writes sleep to Apple Health or Health Connect (Apple Watch, Oura, Garmin, WHOOP, Samsung and more) can share its nights, stages and overnight heart rate, HRV and breathing with the app."}
        </p>
        <div className="mt-2">
          <SleepImportCard enabled={importEnabled && Boolean(profile.wellness_consent_at)} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ActionButton action={setSleepImportEnabledAction} fields={{ enabled: importEnabled ? "" : "on" }} variant="secondary">
            {importEnabled ? "Switch import off" : "Switch import on"}
          </ActionButton>
          <span className="text-sm text-muted-foreground">{importEnabled ? "Import is on" : "Import is off: nothing new is read from your phone"}</span>
        </div>
        {runs.length > 0 && (
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border text-sm" aria-label="Recent imports">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span>
                  {IMPORT_SOURCE_LABEL[r.source]}
                  {r.device ? ` · ${r.device}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {when(r.created_at)}: {r.added} added, {r.duplicates} already there, {r.conflicts} overlapped
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ActionButton action={deleteImportedSleepAction} fields={{}} variant="destructive" confirmMessage="Delete every imported entry?" confirmLabel="Delete imported" confirmDetail="Entries you made yourself stay. Your phone's own health records are not touched." disabled={!importedCount}>
            <Trash2 className="size-4" aria-hidden /> Delete imported entries
          </ActionButton>
          <span className="text-sm text-muted-foreground">{importedCount ?? 0} imported</span>
        </div>
        {profile.sleep_import_source && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <ActionButton action={disconnectSleepSourceAction} fields={{}} variant="secondary" confirmMessage={`Disconnect ${IMPORT_SOURCE_LABEL[profile.sleep_import_source]}?`} confirmLabel="Disconnect" confirmDetail="Imports stop and the connection is forgotten. Nights already imported stay unless you remove them below.">
              Disconnect
            </ActionButton>
            <ActionButton action={disconnectSleepSourceAction} fields={{ remove: "on" }} variant="destructive" confirmMessage={`Disconnect and remove imported nights?`} confirmLabel="Disconnect and remove" confirmDetail="Imports stop, the connection is forgotten and every imported night goes. Entries you made yourself stay; your phone's own health records are not touched.">
              <Trash2 className="size-4" aria-hidden /> Disconnect and remove imported
            </ActionButton>
          </div>
        )}
      </section>

      <section className={card} aria-labelledby="privacy-title">
        <h2 id="privacy-title" className="font-display text-xl font-bold uppercase">
          Data &amp; privacy
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Stored: the bed and wake times you log, naps, the optional detail you add, and records you import from a health platform. Nothing is recorded by your phone&apos;s microphone or sensors.</li>
          <li>Seen by: you. The AI coach gets a summary only when you ask it about your sleep (Pro, and only after you allowed AI data sharing).</li>
          <li>{consentedOn ? `You allowed wellness information on ${consentedOn}.` : "Wellness information isn't allowed yet."} The same permission covers recovery check-ins.</li>
          <li>Deleted with your account, and exported with your data.</li>
        </ul>
        {countError || importedError ? (
          <Notice tone="error" className="mt-4">
            Couldn&apos;t count your sleep entries just now. Try again in a moment.
          </Notice>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ActionButton
                action={deleteAllSleepDataAction}
                fields={{}}
                variant="destructive"
                confirmMessage="Delete all sleep data?"
                confirmLabel="Delete all"
                confirmDetail={`${count ?? 0} ${count === 1 ? "entry" : "entries"}, every check-in and the import history will be removed for good.`}
                disabled={!count}
              >
                <Trash2 className="size-4" aria-hidden /> Delete all sleep data
              </ActionButton>
              <span className="text-sm text-muted-foreground">{count ?? 0} stored</span>
            </div>
            {!count && <Notice className="mt-3">Nothing stored yet.</Notice>}
          </>
        )}
      </section>
    </div>
  );
}
