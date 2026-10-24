import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppOpeningOverlay } from "@/components/common/app-opening-overlay";
import { NativeInit } from "@/components/shell/native-init";
import { ServiceWorkerRegistration } from "@/components/shell/sw-register";
import { ConfirmHost } from "@/components/ui/confirm";
import { Toaster } from "@/components/ui/toaster";
import { ACTIVE_TRANSLATION, scriptureText } from "@/data/scripture";
import { OPENING_SCRIPT } from "@/lib/opening";
import "./globals.css";

// The fonts ship with the app (./fonts, the Google Fonts files, SIL Open Font License) so builds never depend on
// reaching Google Fonts.
const inter = localFont({ src: "./fonts/inter-latin-wght-normal.woff2", weight: "100 900", variable: "--font-inter", display: "swap" });
const heading = localFont({ src: "./fonts/plus-jakarta-sans-latin-wght-normal.woff2", weight: "200 800", variable: "--font-heading", display: "swap" });
// Engraved capitals for the rank badge ladders (matches the owner's badge artwork).
const engraved = localFont({ src: "./fonts/cinzel-latin-wght-normal.woff2", weight: "400 900", variable: "--font-engraved", display: "swap" });
const serif = localFont({
  src: [
    { path: "./fonts/lora-latin-wght-normal.woff2", weight: "400 700", style: "normal" },
    { path: "./fonts/lora-latin-wght-italic.woff2", weight: "400 700", style: "italic" },
  ],
  variable: "--font-serif-face",
  display: "swap",
});

/**
 * Applies the saved text-size and reduce-motion preferences before first paint (no layout jump).
 * Signed-in users' preferences are synced from their profile into localStorage by the app shell.
 */
const PREFS_SCRIPT = `try{var d=document.documentElement,t=localStorage.getItem("ngf.textSize"),m=localStorage.getItem("ngf.reduceMotion");if(t==="large"||t==="xlarge")d.dataset.textSize=t;if(m==="1")d.dataset.motion="reduce"}catch(e){}`;

export const metadata: Metadata = {
  title: { default: "Narrow Gate Fitness", template: "%s · Narrow Gate Fitness" },
  description: "Rooted in faith. Built for strength. Premium training programs, workout tracking, nutrition and AI coaching.",
  applicationName: "Narrow Gate Fitness",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Narrow Gate", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#070707",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${heading.variable} ${serif.variable} ${engraved.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
        {/* Decides before the first paint whether this load plays the opening (src/lib/opening.ts). */}
        <script dangerouslySetInnerHTML={{ __html: OPENING_SCRIPT }} />
      </head>
      <body className="font-sans">
        {/* First in the body so it is in the first streamed chunk; hidden unless the script above chose to play it. */}
        <AppOpeningOverlay verse={scriptureText("Matthew 7:13–14", "")} translation={ACTIVE_TRANSLATION.code} />
        {children}
        <Toaster />
        <ConfirmHost />
        <ServiceWorkerRegistration />
        <NativeInit />
      </body>
    </html>
  );
}
