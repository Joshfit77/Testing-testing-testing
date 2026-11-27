#!/usr/bin/env node
// Claims the site's domain for universal links (iOS) and App Links (Android), O-05. Run it once the owner has:
//   1. enabled "Associated Domains" for the App ID in the Apple Developer account (otherwise signing fails), and
//   2. set APPLE_TEAM_ID / ANDROID_APP_CERT_SHA256 on the hosting so /.well-known/* are served.
// Usage: APP_LINKS_DOMAIN=app.example.com node scripts/native/app-links.mjs [--root <dir>]
// Idempotent: running it again changes nothing. Without APP_LINKS_DOMAIN it does nothing and says so.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PATHS = ["/auth/confirm", "/auth/callback", "/reset-password"];
const args = process.argv.slice(2);
const root = args.includes("--root") ? args[args.indexOf("--root") + 1] : process.cwd();
const domain = (process.env.APP_LINKS_DOMAIN ?? "").trim().toLowerCase();

if (!domain) {
  console.log("APP_LINKS_DOMAIN not set: universal links stay off (nothing changed).");
  process.exit(0);
}
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
  console.error(`APP_LINKS_DOMAIN "${domain}" is not a plain host name (no scheme, path or port).`);
  process.exit(1);
}

// iOS: com.apple.developer.associated-domains = [applinks:<domain>]
const entPath = join(root, "ios/App/App/App.entitlements");
let ent = readFileSync(entPath, "utf8");
const entry = `<string>applinks:${domain}</string>`;
if (!ent.includes(entry)) {
  if (ent.includes("<key>com.apple.developer.associated-domains</key>")) {
    ent = ent.replace(/(<key>com\.apple\.developer\.associated-domains<\/key>\s*<array>)/, `$1\n\t\t${entry}`);
  } else {
    ent = ent.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>com.apple.developer.associated-domains</key>\n\t<array>\n\t\t${entry}\n\t</array>\n</dict>\n</plist>\n`);
  }
  writeFileSync(entPath, ent);
  console.log(`iOS: added applinks:${domain}`);
} else console.log("iOS: already claimed");

// Android: a verified intent filter on the main activity for the claimed paths.
const manPath = join(root, "android/app/src/main/AndroidManifest.xml");
let man = readFileSync(manPath, "utf8");
const marker = `<!-- app-links:${domain} -->`;
if (!man.includes(marker)) {
  const data = PATHS.map((p) => `                <data android:scheme="https" android:host="${domain}" android:pathPrefix="${p}" />`).join("\n");
  const filter = `            ${marker}
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
${data}
            </intent-filter>
`;
  const launcherEnd = /(<category android:name="android\.intent\.category\.LAUNCHER" \/>\s*<\/intent-filter>\n)/;
  if (!launcherEnd.test(man)) {
    console.error("Android: couldn't find the launcher intent filter in AndroidManifest.xml; nothing changed.");
    process.exit(1);
  }
  man = man.replace(launcherEnd, `$1${filter}`);
  writeFileSync(manPath, man);
  console.log(`Android: added a verified intent filter for ${domain}`);
} else console.log("Android: already claimed");
