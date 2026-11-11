import { DRAFT_PREFIX } from "@/lib/drafts";

/*
 * Journey check-ins tapped without a connection. They wait on this device with the time of the tap and are sent when
 * the connection returns, from whichever screen is open (the app shell) as well as from the Faith screens. The server
 * alone decides whether a late one still counts; nothing here changes when a day closes or the restart rule.
 */

export type CheckinActivity = "reading" | "prayer";
export interface PendingCheckin {
  journeyId: string;
  activity: CheckinActivity;
  occurredAt: string;
}

/** Fired on window after the queue changes, so a mounted check-in card can show what is still waiting. */
export const CHECKIN_QUEUE_EVENT = "ngf:faith-checkins";

/** Saved under the member's draft prefix, so signing out clears it (src/lib/drafts.ts). Holds no prayer content. */
export const checkinQueueKey = (userId: string) => `${DRAFT_PREFIX}${userId}.faith-checkins`;

export function readCheckinQueue(userId: string): PendingCheckin[] {
  try {
    const v = JSON.parse(localStorage.getItem(checkinQueueKey(userId)) ?? "[]") as PendingCheckin[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function writeCheckinQueue(userId: string, q: PendingCheckin[]) {
  try {
    if (q.length) localStorage.setItem(checkinQueueKey(userId), JSON.stringify(q));
    else localStorage.removeItem(checkinQueueKey(userId));
  } catch {
    /* storage unavailable */
  }
  try {
    window.dispatchEvent(new Event(CHECKIN_QUEUE_EVENT));
  } catch {
    /* no window */
  }
}

/** What sending one check-in came back with; "network" when the request itself didn't complete. */
export type CheckinSendResult = { ok: true } | { ok: false; code: string; error: string } | "network";

export interface FlushOptions {
  /** The member's active journey (null: none), or a way to look it up. It is only looked up when something is waiting. */
  journeyId: string | null | (() => Promise<string | null>);
  send: (activity: CheckinActivity, occurredAt: string) => Promise<CheckinSendResult>;
  notify: (tone: "success" | "error", message: string) => void;
}

const sameItem = (a: PendingCheckin, b: PendingCheckin) => a.journeyId === b.journeyId && a.activity === b.activity && a.occurredAt === b.occurredAt;
const inFlight = new Map<string, Promise<{ changed: boolean }>>();

async function flush(userId: string, opts: FlushOptions): Promise<{ changed: boolean }> {
  const q = readCheckinQueue(userId);
  if (!q.length) return { changed: false };
  let journeyId: string | null;
  try {
    journeyId = typeof opts.journeyId === "function" ? await opts.journeyId() : opts.journeyId;
  } catch {
    return { changed: false }; // couldn't ask: everything stays queued for the next try
  }
  const settled: PendingCheckin[] = [];
  for (const p of q) {
    const label = p.activity === "reading" ? "Bible reading" : "prayer";
    const when = new Date(p.occurredAt).toLocaleString();
    if (p.journeyId !== journeyId) {
      // A journey that has since ended: nothing to count it toward.
      settled.push(p);
      opts.notify("error", `Your ${label} check-in from ${when} was for a journey that has since ended, so it wasn't counted.`);
      continue;
    }
    let r: CheckinSendResult;
    try {
      r = await opts.send(p.activity, p.occurredAt);
    } catch {
      r = "network";
    }
    // No answer, or the server couldn't save it just now: keep it and try again later. When it does arrive, the
    // server still decides from the time of the tap whether it counts.
    if (r === "network" || (!r.ok && r.code === "error")) continue;
    settled.push(p);
    if (r.ok) opts.notify("success", `${p.activity === "reading" ? "Bible reading" : "Prayer"} you marked offline is saved.`);
    else if (r.code === "too_late") opts.notify("error", `Your ${label} check-in from ${when} reached us too late to count. ${r.error}`);
    else opts.notify("error", `Your ${label} check-in from ${when} couldn't be counted. ${r.error}`);
  }
  // Re-read before writing: a check-in queued while this was running must not be lost.
  if (settled.length) writeCheckinQueue(userId, readCheckinQueue(userId).filter((p) => !settled.some((s) => sameItem(s, p))));
  return { changed: settled.length > 0 };
}

/**
 * Send every waiting check-in. One run at a time per member: a second caller (the shell and a Faith screen both
 * notice the connection return) gets the run already in progress, so nothing is sent or announced twice.
 */
export function flushCheckinQueue(userId: string, opts: FlushOptions): Promise<{ changed: boolean }> {
  const running = inFlight.get(userId);
  if (running) return running;
  const run = flush(userId, opts).finally(() => inFlight.delete(userId));
  inFlight.set(userId, run);
  return run;
}
