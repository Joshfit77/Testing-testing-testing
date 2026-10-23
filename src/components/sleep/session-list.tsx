import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { clockMinutesInTz, formatClock, formatDuration, sleepDurations, SLEEP_SOURCE_LABELS, type SleepSession } from "@/lib/domain/sleep";
import { deleteSleepSessionAction } from "@/server/actions/sleep";

export function formatNightDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** Nights and naps as a list, newest first, with edit and delete. */
export function SleepSessionList({ sessions, emptyText }: { sessions: SleepSession[]; emptyText: string }) {
  if (!sessions.length) return <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
      {sessions.map((s) => {
        const d = sleepDurations(s);
        const editable = s.source === "manual" || s.source === "timer";
        return (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {formatNightDate(s.nightOf)}
                {s.kind === "nap" && <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">Nap</span>}
                {!s.endedAt && <span className="ml-2 rounded-full border border-gold/50 px-2 py-0.5 text-xs font-medium text-gold-highlight">Running</span>}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatClock(clockMinutesInTz(s.startedAt, s.timezone))}
                {s.endedAt ? ` – ${formatClock(clockMinutesInTz(s.endedAt, s.timezone))}` : ""}
                {d.asleepMinutes !== null && (
                  <>
                    {" · "}
                    <span className="text-foreground">{formatDuration(d.asleepMinutes)}</span>
                    {d.asleepEstimated ? " in bed" : " asleep"}
                  </>
                )}
                {" · "}
                {SLEEP_SOURCE_LABELS[s.source]}
              </p>
              {s.notes && <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.notes}</p>}
            </div>
            {editable && s.endedAt && (
              <Link href={`/progress/sleep/log?id=${s.id}`} className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground" aria-label={`Edit sleep for ${formatNightDate(s.nightOf)}`}>
                <Pencil className="size-4" aria-hidden />
              </Link>
            )}
            <ActionButton
              action={deleteSleepSessionAction}
              fields={{ id: s.id }}
              variant="ghost"
              size="icon"
              aria-label={`Delete sleep for ${formatNightDate(s.nightOf)}`}
              confirmMessage="Delete this sleep entry?"
              confirmLabel="Delete"
              confirmDetail="It is removed from your history. This can't be undone."
            >
              <Trash2 className="size-4" aria-hidden />
            </ActionButton>
          </li>
        );
      })}
    </ul>
  );
}
