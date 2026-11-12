"use client";

import { useEffect, useState, useTransition } from "react";
import { Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialTimeZoneOptions, timeZoneOptions } from "@/lib/time-zone-options";
import { setJourneyTimezoneAction } from "@/server/actions/journeys";

/**
 * The journey's time zone, and an explicit way to change it. The journey keeps the zone it started with; changing the
 * profile's zone doesn't move its days. A change waits for the next midnight (in both zones), so today's deadline never
 * moves and no day is skipped.
 */
export function JourneyTimezone({
  timezone,
  profileTimezone,
  pending,
}: {
  timezone: string;
  profileTimezone: string;
  pending: { timezone: string; switchAt: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(pending?.timezone ?? (profileTimezone !== timezone ? profileTimezone : timezone));
  const [options, setOptions] = useState(() => initialTimeZoneOptions(choice));
  const [state, setState] = useState<{ pending: { timezone: string; switchAt: string } | null; error: string | null }>({ pending, error: null });
  const [busy, start] = useTransition();
  useEffect(() => {
    if (open) setOptions(timeZoneOptions(choice));
  }, [open, choice]);

  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: timezone, timeZoneName: "short" });
  const submit = (tz: string) =>
    start(async () => {
      const res = await setJourneyTimezoneAction(tz);
      if (!res.ok) return setState((s) => ({ ...s, error: res.error }));
      setState({ pending: res.pending && res.switchAt ? { timezone: res.pending, switchAt: res.switchAt } : null, error: null });
      setOpen(false);
    });

  return (
    <div className="mt-2 space-y-2 text-sm" data-testid="journey-timezone">
      <p className="text-muted-foreground">
        Days follow <span className="font-semibold text-foreground">{timezone}</span>, the time zone this journey started in.
      </p>
      {state.pending && (
        <p className="rounded-lg border border-gold-muted/60 bg-gold/8 p-2" role="status" data-testid="journey-timezone-pending">
          Changing to <span className="font-semibold">{state.pending.timezone}</span> at {when(state.pending.switchAt)} (the next midnight). Today keeps its deadline.{" "}
          <button type="button" className="font-semibold text-gold-highlight underline-offset-4 hover:underline" disabled={busy} onClick={() => submit(timezone)}>
            Keep {timezone}
          </button>
        </p>
      )}
      {!open ? (
        <Button type="button" variant="ghost" size="sm" className="-ml-2 min-h-11" onClick={() => setOpen(true)}>
          <Globe2 aria-hidden /> Change time zone
        </Button>
      ) : (
        <form
          className="space-y-2 rounded-xl border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(choice);
          }}
        >
          <label htmlFor="journey-tz" className="block font-semibold">
            Time zone for this journey
          </label>
          <select id="journey-tz" className="h-11 w-full rounded-lg border border-border bg-elevated px-2" value={choice} onChange={(e) => setChoice(e.target.value)}>
            {options.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground">
            The change starts at the next midnight, so today keeps its deadline and no day is skipped. Days you&rsquo;ve already completed stay exactly as they are.
          </p>
          {state.error && (
            <p className="text-destructive-foreground" role="alert">
              {state.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" className="min-h-11" disabled={busy || (choice === timezone && !state.pending)}>
              {busy ? "Saving…" : "Change at midnight"}
            </Button>
            <Button type="button" size="sm" variant="secondary" className="min-h-11" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
