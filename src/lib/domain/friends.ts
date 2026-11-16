/**
 * Friends (migration 076): opt-in, behind the `friends_challenges` flag. Pure rules shared by the server actions, the
 * screens and the tests. The database enforces the same rules (claim_username, send_friend_request, ...); these copies
 * give members a clear answer before a request is made.
 */
import { INVITE_CODE_LENGTH, formatInviteCode, generateInviteCode, normalizeInviteCode } from "@/lib/domain/accountability";

export { formatInviteCode, generateInviteCode, normalizeInviteCode, INVITE_CODE_LENGTH };

export const MAX_FRIENDS = 200;
export const MAX_OPEN_FRIEND_INVITES = 5;
export const FRIEND_INVITE_TTL_DAYS = 7;
export const REQUESTS_PER_DAY = 20;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_CHANGE_DAYS = 30;
export const SEARCH_MIN_CHARS = 3;

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
/** Names that could pass for the app or its staff (the same list as claim_username in migration 076). */
const RESERVED = new Set(["admin", "administrator", "support", "staff", "official", "moderator", "mod", "system", "help", "team", "narrowgate", "narrow_gate", "narrowgatefitness", "narrow_gate_fitness", "ngf", "coach", "aicoach", "ai_coach"]);

/** What a member typed, as a stored username: trimmed, a leading @ dropped, lower case. */
export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@/, "").toLowerCase();
}

/** Why a username can't be used, or null when it can (before the database checks that it is free). */
export function usernameProblem(input: string): string | null {
  const name = normalizeUsername(input);
  if (name.length < USERNAME_MIN) return `Use at least ${USERNAME_MIN} characters.`;
  if (name.length > USERNAME_MAX) return `Use ${USERNAME_MAX} characters or fewer.`;
  if (!USERNAME_RE.test(name)) return "Use letters, numbers and underscores only.";
  if (RESERVED.has(name) || name.startsWith("narrowgate") || name.startsWith("narrow_gate")) return "That username isn't available.";
  return null;
}

/** A search term the database will accept (at least 3 valid characters), or null. */
export function normalizeSearch(input: string): string | null {
  const q = normalizeUsername(input);
  return USERNAME_RE.test(q) ? q : null;
}

export type PrivacyKey = "searchable" | "profile_visible" | "show_workouts" | "show_records" | "show_body" | "show_nutrition" | "show_faith" | "show_in_leaderboards";
export type PrivacySettings = Record<PrivacyKey, boolean>;

/** Defaults for a new member of Friends (migration 076). Body, nutrition and Faith are private unless turned on. */
export const DEFAULT_PRIVACY: PrivacySettings = {
  searchable: true,
  profile_visible: true,
  show_workouts: true,
  show_records: false,
  show_body: false,
  show_nutrition: false,
  show_faith: false,
  show_in_leaderboards: true,
};

export const PRIVACY_KEYS = Object.keys(DEFAULT_PRIVACY) as PrivacyKey[];

export function isPrivacyKey(key: string): key is PrivacyKey {
  return Object.prototype.hasOwnProperty.call(DEFAULT_PRIVACY, key);
}

/** Each switch in the member's words. `sensitive` ones are off by default and say so. */
export const PRIVACY_OPTIONS: { key: PrivacyKey; label: string; detail: string; sensitive?: boolean; group: "finding" | "friends" }[] = [
  { key: "searchable", group: "finding", label: "Let people find me by username", detail: "Off: only people you send a request or an invite link to can connect with you." },
  { key: "profile_visible", group: "friends", label: "Show my profile to friends", detail: "Off: friends see your name and username, nothing else." },
  { key: "show_workouts", group: "friends", label: "Workouts and streak", detail: "How many workouts you completed in the last 7 days and your streaks. Numbers only, never what you did." },
  { key: "show_records", group: "friends", label: "Personal records", detail: "Your best lifts, for comparing the same exercise with a friend." },
  { key: "show_in_leaderboards", group: "friends", label: "Appear in friend rankings", detail: "Off: you're left out of comparisons between friends." },
  { key: "show_body", group: "friends", sensitive: true, label: "Weight and body measurements", detail: "Private unless you turn this on." },
  { key: "show_nutrition", group: "friends", sensitive: true, label: "Nutrition", detail: "Private unless you turn this on." },
  { key: "show_faith", group: "friends", sensitive: true, label: "Faith and discipline activity", detail: "Reading and prayer streaks only. Private unless you turn this on." },
];

/** Never visible to a friend, whatever the switches say. */
export const FRIENDS_NEVER_SHARED = ["Prayer journal and Faith notes", "Sleep", "Progress photos and body scans", "AI Coach conversations", "Individual exercises, sets and workout notes", "Your email address"] as const;

export const REPORT_REASONS = {
  harassment: "Harassment or bullying",
  inappropriate_name: "Inappropriate username or name",
  impersonation: "Pretending to be someone else",
  spam: "Spam",
  other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export const REPORT_REASON_KEYS = Object.keys(REPORT_REASONS) as ReportReason[];
export const REPORT_DETAILS_MAX = 500;

export function isReportReason(key: string): key is ReportReason {
  return Object.prototype.hasOwnProperty.call(REPORT_REASONS, key);
}

export type Relation = "friend" | "requested" | "incoming" | "none";

export interface SearchHit {
  userId: string;
  username: string;
  relation: Relation;
}

export interface FriendEntry {
  userId: string;
  username: string;
  displayName: string;
  since: string;
}

export interface RequestEntry {
  requestId: string;
  userId: string;
  username: string;
  at: string;
}

export interface BlockedEntry {
  userId: string;
  /** Null when the blocked member never chose a username. */
  username: string | null;
}

export interface FriendsOverview {
  friends: FriendEntry[];
  incoming: RequestEntry[];
  outgoing: RequestEntry[];
  blocked: BlockedEntry[];
}

const str = (v: unknown, max: number): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (v: unknown): string | undefined => (typeof v === "string" && UUID_RE.test(v) ? v : undefined);
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)) : []);
const count = (v: unknown): number | undefined => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined);

/** Reads what friends_overview() returned, keeping only known fields with the right shapes. */
export function parseOverview(raw: unknown): FriendsOverview | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const requests = (v: unknown): RequestEntry[] =>
    list(v).flatMap((x) => {
      const requestId = id(x.request_id);
      const userId = id(x.user_id);
      const username = str(x.username, USERNAME_MAX);
      const at = str(x.at, 40);
      return requestId && userId && username && at ? [{ requestId, userId, username, at }] : [];
    });
  return {
    friends: list(r.friends).flatMap((x) => {
      const userId = id(x.user_id);
      const username = str(x.username, USERNAME_MAX);
      const since = str(x.since, 40);
      return userId && username && since ? [{ userId, username, displayName: str(x.display_name, 60) ?? username, since }] : [];
    }),
    incoming: requests(r.incoming),
    outgoing: requests(r.outgoing),
    blocked: list(r.blocked).flatMap((x) => {
      const userId = id(x.user_id);
      return userId ? [{ userId, username: str(x.username, USERNAME_MAX) ?? null }] : [];
    }),
  };
}

export function parseSearch(raw: unknown): SearchHit[] {
  return list(raw).flatMap((x) => {
    const userId = id(x.user_id);
    const username = str(x.username, USERNAME_MAX);
    const relation = x.relation;
    return userId && username && (relation === "friend" || relation === "requested" || relation === "incoming" || relation === "none") ? [{ userId, username, relation }] : [];
  });
}

/** What a friend lets me see: only the fields they chose to share are present. */
export interface FriendProfile {
  userId: string;
  username: string;
  displayName: string;
  since: string;
  /** False: the friend keeps their profile to themselves; nothing below is present. */
  profileVisible: boolean;
  workoutsLast7Days?: number;
  streakDays?: number;
  streakWeeks?: number;
}

/**
 * Reads what friend_profile() returned, keeping only the known, shareable fields with the right shapes. Anything
 * else is dropped, so the screen can never show more than this whitelist.
 */
export function parseFriendProfile(raw: unknown): FriendProfile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const userId = id(r.user_id);
  const username = str(r.username, USERNAME_MAX);
  const since = str(r.since, 40);
  if (!userId || !username || !since) return null;
  const out: FriendProfile = { userId, username, displayName: str(r.display_name, 60) ?? username, since, profileVisible: r.profile_visible === true };
  if (!out.profileVisible) return out;
  const workouts = count(r.workouts_last_7_days);
  const days = count(r.streak_days);
  const weeks = count(r.streak_weeks);
  if (workouts !== undefined) out.workoutsLast7Days = workouts;
  if (days !== undefined && weeks !== undefined) {
    out.streakDays = days;
    out.streakWeeks = weeks;
  }
  return out;
}

/** The invite link for a code. It carries the code only: nothing about the member. */
export function inviteUrl(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/friends/invite/${code}`;
}

export function friendInviteShareText(url: string, expiresAt: string): string {
  const until = new Date(expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `Train with me on Narrow Gate Fitness. This link adds me as your friend (one use, valid until ${until}): ${url}`;
}

/** Two initials for the round badge beside a name. */
export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N}\s_]/gu, "").split(/[\s_]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0]![0]! + parts[1]![0]! : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** Plain-language reasons for the database's Friends errors. */
export const FRIENDS_ERRORS: Record<string, string> = {
  friends_off: "Friends isn't available right now.",
  username_invalid: "Use 3 to 20 letters, numbers and underscores.",
  username_reserved: "That username isn't available.",
  username_taken: "That username is taken. Try another.",
  username_change_wait: `You changed your username recently. You can change it once every ${USERNAME_CHANGE_DAYS} days.`,
  username_required: "Choose a username first.",
  self_request: "That's you.",
  user_not_found: "That member wasn't found.",
  already_friends: "You're already friends.",
  already_requested: "You've already sent this member a request.",
  request_cooldown: "You sent this member a request recently. You can try again later.",
  request_limit: `You've sent ${REQUESTS_PER_DAY} requests in the last 24 hours. Try again tomorrow.`,
  request_not_found: "That request is no longer open.",
  friend_limit: `One of you already has ${MAX_FRIENDS} friends.`,
  invite_not_found: "That invite link wasn't found. Ask your friend for a new one.",
  invite_used: "That invite link has already been used. Ask your friend for a new one.",
  invite_expired: "That invite link has expired. Ask your friend for a new one.",
  own_invite: "That's your own invite link. Send it to a friend instead.",
  unknown_reason: "Choose a reason.",
  details_too_long: `Keep the details under ${REPORT_DETAILS_MAX} characters.`,
  report_limit: "You've sent several reports today. Thank you; we'll review them.",
};

export function friendsErrorMessage(message: string | undefined): string | null {
  if (!message || !Object.prototype.hasOwnProperty.call(FRIENDS_ERRORS, message)) return null;
  return FRIENDS_ERRORS[message]!;
}
