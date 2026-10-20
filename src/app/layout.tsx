import type { Metadata, Viewport } from "next";
import { Inter, Lora, Plus_Jakarta_Sans } from "next/font/google";
import { NativeInit } from "@/components/shell/native-init";
import { ServiceWorkerRegistration } from "@/components/shell/sw-register";
import { ConfirmHost } from "@/components/ui/confirm";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const heading = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-heading", weight: ["500", "600", "700", "800"], display: "swap" });
const serif = Lora({ subsets: ["latin"], variable: "--font-serif-face", weight: ["500", "600"], style: ["normal", "italic"], display: "swap" });

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
    <html lang="en" className={`${inter.variable} ${heading.variable} ${serif.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body className="font-sans">
        {children}
        <Toaster />
        <ConfirmHost />
        <ServiceWorkerRegistration />
        <NativeInit />
      </body>
    </html>
  );
}
