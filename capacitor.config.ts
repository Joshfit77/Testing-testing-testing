import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize, KeyboardStyle } from "@capacitor/keyboard";

/**
 * Native iOS/Android shells for Narrow Gate Fitness.
 *
 * The app is a server-rendered Next.js application (server actions, auth cookies, Stripe/AI on the
 * server), so the native shells load the deployed site rather than a static bundle. Set
 * CAP_SERVER_URL to the HTTPS address where the full app is deployed before `npx cap sync`. There is
 * no default: syncing the online edition without a real address stops with an error, so a build can
 * never ship pointing at a placeholder. For local device or simulator testing you can point it at your
 * machine (http://192.168.x.x:3000, http://127.0.0.1:3000) with CAP_ALLOW_CLEARTEXT=true.
 *
 * Change `appId` to a reverse-domain identifier you own before submitting to the stores.
 */
const cleartext = process.env.CAP_ALLOW_CLEARTEXT === "true";
/**
 * CAP_MODE=standalone bundles the offline edition (standalone/index.html) instead of loading the
 * server: every screen works on the device with data stored locally, but there are no accounts,
 * payments or AI coach. Used for the downloadable test APK and the compile-only iOS check; never for
 * TestFlight.
 */
const standalone = process.env.CAP_MODE === "standalone";
/** Commands that write the native projects' config; the others (open, ls, doctor) don't need the address. */
const writesNativeConfig = ["sync", "copy", "update", "run", "build"].includes(process.argv[2] ?? "");

function onlineServerUrl(value: string | undefined): string {
  const fail = (why: string): never => {
    throw new Error(`CAP_SERVER_URL ${why}. Set it to the HTTPS address of the deployed app, e.g. CAP_SERVER_URL=https://<your domain> npx cap sync ios (or CAP_MODE=standalone for the offline edition).`);
  };
  if (!value) return writesNativeConfig ? fail("is not set") : "https://deployed-app-address.invalid";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(`is not a valid URL ("${value}")`);
  }
  if (/\.(example|invalid|test|localhost)$/i.test(url.hostname)) fail(`points at a placeholder domain (${url.hostname})`);
  if (url.protocol !== "https:" && !cleartext) fail(`must use https:// (got ${url.protocol}//; CAP_ALLOW_CLEARTEXT=true is for local testing only)`);
  return url.href.replace(/\/$/, "");
}

const serverUrl = standalone ? "" : onlineServerUrl(process.env.CAP_SERVER_URL);

const config: CapacitorConfig = {
  appId: process.env.CAP_APP_ID ?? "com.narrowgatefitness.app",
  appName: "Narrow Gate Fitness",
  webDir: standalone ? "standalone" : "native-shell",
  backgroundColor: "#090909",
  // The web app checks for this token to hide web-only purchase flows inside the store apps.
  appendUserAgent: "NarrowGateApp",
  server: standalone
    ? { androidScheme: "https" }
    : {
        url: serverUrl,
        cleartext,
        errorPath: "error.html",
        allowNavigation: [new URL(serverUrl).host],
      },
  ios: {
    contentInset: "never",
    scheme: "Narrow Gate Fitness",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: cleartext,
    // Needed by @capacitor-community/background-geolocation: without the legacy bridge, location updates stop after
    // about five minutes in the background (GPS runs and walks).
    useLegacyBridge: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#090909",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: KeyboardStyle.Dark,
      backgroundColor: "#090909",
      overlaysWebView: false,
    },
    LocalNotifications: {
      iconColor: "#C9A54C",
    },
    // On-screen keyboard (@capacitor/keyboard): the web view itself shrinks above the keyboard
    // ("native"), so fixed bottom bars and sheets move up with it and focused fields stay visible.
    // resizeOnFullScreen keeps that working on Android when the app draws edge-to-edge.
    // The web app also hides the tab bar and scrolls the focused field into view
    // (src/components/platform/keyboard-avoidance.tsx). Run `npx cap sync` after installing.
    Keyboard: {
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true,
      style: KeyboardStyle.Dark,
    },
  },
};

export default config;
