import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize, KeyboardStyle } from "@capacitor/keyboard";

/**
 * Native iOS/Android shells for Narrow Gate Fitness.
 *
 * The app is a server-rendered Next.js application (server actions, auth cookies, Stripe/AI on the
 * server), so the native shells load the deployed site rather than a static bundle. Set
 * CAP_SERVER_URL to your production URL (e.g. https://app.narrowgatefitness.com) before `npx cap sync`.
 * For local device testing you can point it at your machine's LAN address (http://192.168.x.x:3000)
 * with CAP_ALLOW_CLEARTEXT=true.
 *
 * Change `appId` to a reverse-domain identifier you own before submitting to the stores.
 */
const serverUrl = process.env.CAP_SERVER_URL ?? "https://app.narrowgatefitness.example";
const cleartext = process.env.CAP_ALLOW_CLEARTEXT === "true";
/**
 * CAP_MODE=standalone bundles the offline edition (standalone/index.html) instead of loading the
 * server: every screen works on the device with data stored locally, but there are no accounts,
 * payments or AI coach. Used for the downloadable test APK.
 */
const standalone = process.env.CAP_MODE === "standalone";

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
