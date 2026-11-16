/**
 * What may be sent to the AI provider from Apple Health / Health Connect (migration 079). Data a health platform or a
 * wearable supplied is sent only when the member has turned on the separate "Share Apple Health / Health Connect data
 * with the AI Coach" permission (profiles.health_ai_share_consent_at), on top of the general AI consent. Data the
 * member typed in is not affected. The device's name is never sent: it often contains a person's name.
 */
export const HEALTH_PLATFORM_SOURCES = ["apple_health", "health_connect", "wearable"] as const;

export function fromHealthPlatform(source: string | null | undefined): boolean {
  return typeof source === "string" && (HEALTH_PLATFORM_SOURCES as readonly string[]).includes(source);
}

/** True only when both the general AI consent and the health-platform permission are on. */
export function healthAiSharingAllowed(profile: { ai_data_consent_at?: string | null; health_ai_share_consent_at?: string | null } | null | undefined): boolean {
  return Boolean(profile?.ai_data_consent_at) && Boolean(profile?.health_ai_share_consent_at);
}

/** The rows that may go to the AI provider: everything when allowed, otherwise only what the member entered. */
export function withoutHealthPlatformData<T extends { source?: string | null }>(rows: T[], allowed: boolean): T[] {
  return allowed ? rows : rows.filter((r) => !fromHealthPlatform(r.source));
}

/** What the coach is told when imported data was left out, so it says so instead of guessing. */
export const HEALTH_SHARING_OFF_NOTE =
  "Data from Apple Health, Health Connect or a wearable is not included: the athlete hasn't turned on sharing of health-platform data with the AI Coach. If they ask about it, say you can't see it and that they can turn it on under You > Privacy & data. Don't estimate it.";
