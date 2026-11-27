/**
 * How long AI conversations are kept (pure; safe for client and server).
 *
 * Off by default: conversations stay until the member deletes them or their account. When the owner sets
 * AI_CHAT_RETENTION_DAYS (and states the same period in the Privacy Policy), the scheduled job
 * (/api/maintenance/ai-retention) deletes coach messages and Bible-helper messages older than that, and coach
 * conversations with no activity since then. Coaching memories are not affected: members see and delete those
 * themselves (Coach → Memory).
 */

/** Shortest period accepted, so a typo such as "1" can't wipe every conversation overnight. */
export const AI_RETENTION_MIN_DAYS = 30;
/** Longest period accepted (ten years); anything larger is treated as a mistake and leaves retention off. */
export const AI_RETENTION_MAX_DAYS = 3650;

/** The configured retention in whole days, or null when off (unset, blank, not a whole number, or out of range). */
export function aiRetentionDays(raw: string | undefined | null): number | null {
  const text = (raw ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const days = Number(text);
  return days >= AI_RETENTION_MIN_DAYS && days <= AI_RETENTION_MAX_DAYS ? days : null;
}

/** Anything created (or, for a conversation, last active) before this moment is past retention. */
export function retentionCutoff(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 86_400_000);
}
