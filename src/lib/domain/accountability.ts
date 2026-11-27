/**
 * Accountability partners (migration 067): opt-in, behind the `accountability_partners` flag. Pure rules shared by the
 * server actions, the page and the tests. The database enforces the same limits (accept_accountability_invite,
 * send_accountability_nudge and the invite insert policy); these copies give members a clear answer before a request.
 */

/** Active partners a member can have at once. */
export const MAX_PARTNERS = 3;
/** Invites a member can have open (unused and unexpired) at once. */
export const MAX_OPEN_INVITES = 5;
/** Days an invite code stays valid. */
export const INVITE_TTL_DAYS = 7;
/** Encouragements one member can send in one partnership in any 24 hours. */
export const NUDGES_PER_DAY = 3;

/** 32 characters without look-alikes (no I, O, 0 or 1), so a code read aloud or retyped is unambiguous. */
export const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 10;
const CODE_RE = new RegExp(`^[${INVITE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);

/**
 * A new random invite code. 256 is a multiple of 32, so `byte % 32` picks every letter equally often. `random` is
 * injectable for tests; it defaults to the platform's cryptographic generator.
 */
export function generateInviteCode(random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const bytes = random(new Uint8Array(INVITE_CODE_LENGTH));
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += INVITE_ALPHABET[bytes[i]! % INVITE_ALPHABET.length];
  return code;
}

/** What a member typed, as a stored code: spaces and dashes dropped, upper case. Null when it can't be a code. */
export function normalizeInviteCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, "").toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** "ABCDE-FGHJK": easier to read and type. */
export function formatInviteCode(code: string): string {
  return code.length === INVITE_CODE_LENGTH ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

/** Whether an invite can still be accepted at `now`. */
export function inviteIsOpen(invite: { expires_at: string; used_at: string | null }, now: Date = new Date()): boolean {
  return invite.used_at === null && new Date(invite.expires_at).getTime() > now.getTime();
}

/** The message to share with a friend alongside the code. Contains the code only: no data about the member. */
export function inviteShareText(code: string, expiresAt: string): string {
  const until = new Date(expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `Be my accountability partner on Narrow Gate Fitness? Open You > Accountability partners and enter my code ${formatInviteCode(code)} (valid until ${until}, one use).`;
}

/** The fixed encouragements (keys must match the check in migration 067). No free text, so nothing to moderate. */
export const NUDGE_MESSAGES = {
  proud: "Proud of you. Keep it up!",
  keep_going: "Keep going, you've got this.",
  lets_train: "Let's both get a workout in today.",
  rest_well: "Rest well. Recovery counts too.",
  praying: "Praying for you today.",
  be_strong: "Be strong and courageous. (Joshua 1:9)",
} as const;
export type NudgeKey = keyof typeof NUDGE_MESSAGES;
export const NUDGE_KEYS = Object.keys(NUDGE_MESSAGES) as NudgeKey[];

export function isNudgeKey(key: string): key is NudgeKey {
  return Object.prototype.hasOwnProperty.call(NUDGE_MESSAGES, key);
}

/** Encouragements still allowed now, given when this member sent them in this partnership (rolling 24 hours). */
export function nudgesRemaining(sentAt: string[], now: Date = new Date()): number {
  const since = now.getTime() - 24 * 60 * 60 * 1000;
  const recent = sentAt.filter((t) => new Date(t).getTime() > since).length;
  return Math.max(0, NUDGES_PER_DAY - recent);
}

export type ShareKey = "share_workouts" | "share_streak" | "share_program_progress";
export type ShareSettings = Record<ShareKey, boolean>;

/** Defaults for a new partnership (migration 067): workouts and streak on, program progress off. */
export const DEFAULT_SHARES: ShareSettings = { share_workouts: true, share_streak: true, share_program_progress: false };

/** What each switch shares, in the member's words. */
export const SHARE_OPTIONS: { key: ShareKey; label: string; detail: string }[] = [
  { key: "share_workouts", label: "Workouts this week", detail: "How many workouts you completed in the last 7 days (a number only, not what you did)." },
  { key: "share_streak", label: "Workout streak", detail: "Your current day and week training streaks." },
  { key: "share_program_progress", label: "Program progress", detail: "The name of your active program and which week you're in. A program you made yourself shows as \"Custom program\"." },
];

/** Never shared with a partner, whatever the switches say. */
export const NEVER_SHARED = ["Food and nutrition", "Weight and measurements", "Sleep", "Body scans and progress photos", "Prayer journal and Faith notes", "AI Coach conversations", "Individual workouts, exercises, sets and notes"] as const;

/** A partner's shared summary: only the fields they chose to share are present. */
export interface PartnerSummary {
  partnerName: string;
  workoutsLast7Days?: number;
  streakDays?: number;
  streakWeeks?: number;
  /** Present when program progress is shared; null when shared but no program is active. */
  program?: { name: string; week: number; weeks: number } | null;
}

const count = (v: unknown): number | undefined => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined);

/**
 * Reads what accountability_summary() returned, keeping only the known, shareable fields with the right shapes.
 * Anything else (an unexpected key, a wrong type) is dropped, so the page can never show more than the whitelist.
 */
export function parseSummary(raw: unknown): PartnerSummary | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.partner_name === "string" && r.partner_name.trim() ? r.partner_name.trim().slice(0, 60) : "Your partner";
  const out: PartnerSummary = { partnerName: name };
  const workouts = count(r.workouts_last_7_days);
  if (workouts !== undefined) out.workoutsLast7Days = workouts;
  const days = count(r.streak_days);
  const weeks = count(r.streak_weeks);
  if (days !== undefined && weeks !== undefined) {
    out.streakDays = days;
    out.streakWeeks = weeks;
  }
  if ("program" in r) {
    const p = r.program as Record<string, unknown> | null;
    const week = count(p?.week);
    const total = count(p?.weeks);
    out.program = p && typeof p.name === "string" && week !== undefined && total !== undefined ? { name: p.name.slice(0, 120), week, weeks: total } : null;
  }
  return out;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One line per shared item, for the partner card. Empty when the partner shares nothing. */
export function summaryLines(s: PartnerSummary): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  if (s.workoutsLast7Days !== undefined) lines.push({ label: "Workouts, last 7 days", value: String(s.workoutsLast7Days) });
  if (s.streakDays !== undefined && s.streakWeeks !== undefined)
    lines.push({ label: "Streak", value: `${plural(s.streakDays, "day", "days")} · ${plural(s.streakWeeks, "week", "weeks")}` });
  if (s.program !== undefined) lines.push({ label: "Program", value: s.program ? `${s.program.name} · week ${s.program.week} of ${s.program.weeks}` : "No active program" });
  return lines;
}

/** Plain-language reasons for the database's accountability errors. */
export const ACCOUNTABILITY_ERRORS: Record<string, string> = {
  invite_not_found: "That code wasn't found. Check it and try again.",
  invite_used: "That code has already been used. Ask your friend for a new one.",
  invite_expired: "That code has expired. Ask your friend for a new one.",
  own_invite: "That's your own code. Share it with a friend instead.",
  already_partners: "You're already partners.",
  partner_limit: `You already have ${MAX_PARTNERS} partners. End one partnership to add another.`,
  inviter_partner_limit: `Your friend already has ${MAX_PARTNERS} partners.`,
  nudge_limit: `You've sent ${NUDGES_PER_DAY} encouragements to this partner in the last 24 hours. Try again later.`,
  not_partners: "That partnership has ended.",
  unknown_message: "Choose one of the messages.",
  accountability_off: "Accountability partners aren't available right now.",
};

/** The member-facing message for a database error, or null when it isn't one of ours. */
export function accountabilityErrorMessage(message: string | undefined): string | null {
  if (!message || !Object.prototype.hasOwnProperty.call(ACCOUNTABILITY_ERRORS, message)) return null;
  return ACCOUNTABILITY_ERRORS[message]!;
}
