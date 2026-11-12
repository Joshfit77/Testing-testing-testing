"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays } from "@/lib/domain/dates";
import { movePlannedSessionAction } from "@/server/actions/calendar";

/** "Move" control for one planned session: pick a new date (today or later, not before the previous session). */
export function MoveSession({ dayId, name, date, minDate }: { dayId: string; name: string; date: string; minDate: string }) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(date === minDate ? addDays(date, 1) : date);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    start(async () => {
      const res = await movePlannedSessionAction({ dayId, date: value });
      setStatus({ ok: res.ok, text: res.message ?? (res.ok ? "Moved." : "Couldn't move the session.") });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="w-full">
      {!open ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} aria-label={`Move ${name}`}>
          <CalendarClock aria-hidden /> Move
        </Button>
      ) : (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2" aria-label={`Move ${name}`}>
          <div className="space-y-1">
            <label htmlFor={`${id}-date`} className="text-sm font-medium">
              New date
            </label>
            <Input id={`${id}-date`} type="date" value={value} min={minDate} onChange={(e) => setValue(e.target.value)} required className="w-44" />
          </div>
          <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Move session
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </form>
      )}
      {status && (
        <p role={status.ok ? "status" : "alert"} className={status.ok ? "mt-1 text-sm text-[#5fc49a]" : "mt-1 text-sm text-[#f08a8a]"}>
          {status.text}
        </p>
      )}
    </div>
  );
}
