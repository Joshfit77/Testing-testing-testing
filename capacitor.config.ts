import type { CapacitorConfig } from "@capacitor/cli";

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

const config: CapacitorConfig = {
  appId: process.env.CAP_APP_ID ?? "com.narrowgatefitness.app",
  appName: "Narrow Gate Fitness",
  webDir: "native-shell",
  backgroundColor: "#090909",
  // The web app checks for this token to hide web-only purchase flows inside the store apps.
  appendUserAgent: "NarrowGateApp",
  server: {
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
      style: "DARK",
      backgroundColor: "#090909",
      overlaysWebView: false,
    },
    LocalNotifications: {
      iconColor: "#C9A54C",
    },
  },
};

export default config;
