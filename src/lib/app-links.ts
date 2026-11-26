/**
 * Universal links (iOS) and App Links (Android) for the links the app emails (O-05): sign-up confirmation, sign-in
 * links and password reset open in the app instead of the browser, where the member's session is.
 *
 * Off until configured: the association files are served only when APPLE_TEAM_ID (iOS) or ANDROID_APP_CERT_SHA256
 * (Android) is set, and the native side only claims the domain after `npm run native:app-links` adds it (the App ID
 * must have the Associated Domains capability first, or signing fails). See docs/production-consolidation and
 * scripts/native/app-links.mjs.
 */
export const APP_LINK_PATHS = ["/auth/confirm", "/auth/callback", "/reset-password"] as const;

export interface AppLinksConfig {
  bundleId: string;
  appleTeamId: string | null;
  androidPackage: string;
  androidFingerprints: string[];
}

const TEAM_ID = /^[A-Z0-9]{10}$/;
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function appLinksConfig(env: Record<string, string | undefined>): AppLinksConfig {
  const appId = env.CAP_APP_ID?.trim() || "com.narrowgatefitness.app";
  const team = env.APPLE_TEAM_ID?.trim().toUpperCase() ?? "";
  const fingerprints = (env.ANDROID_APP_CERT_SHA256 ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => FINGERPRINT.test(f));
  return { bundleId: appId, appleTeamId: TEAM_ID.test(team) ? team : null, androidPackage: appId, androidFingerprints: fingerprints };
}

/** The apple-app-site-association file, or null when iOS universal links aren't configured. */
export function appleAssociation(cfg: AppLinksConfig): unknown | null {
  if (!cfg.appleTeamId) return null;
  return {
    applinks: {
      details: [
        {
          appIDs: [`${cfg.appleTeamId}.${cfg.bundleId}`],
          components: APP_LINK_PATHS.flatMap((p) => [{ "/": p }, { "/": `${p}/*` }]),
        },
      ],
    },
  };
}

/** Digital Asset Links for Android App Links, or null when not configured. */
export function androidAssetLinks(cfg: AppLinksConfig): unknown[] | null {
  if (!cfg.androidFingerprints.length) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: cfg.androidPackage, sha256_cert_fingerprints: cfg.androidFingerprints },
    },
  ];
}

/**
 * Where the app should go for a link it was opened with: the path and query when the link is for this site and one of
 * the claimed paths, otherwise null (anything else stays in the browser).
 */
export function appLinkTarget(link: string, siteOrigin: string): string | null {
  try {
    const url = new URL(link);
    const site = new URL(siteOrigin);
    if (url.protocol !== "https:" || url.host !== site.host) return null;
    if (!APP_LINK_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
