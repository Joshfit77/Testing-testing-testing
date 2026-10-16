import type { Metadata, Viewport } from "next";
import { Inter, Oswald } from "next/font/google";
import { NativeInit } from "@/components/shell/native-init";
import { ServiceWorkerRegistration } from "@/components/shell/sw-register";
import { ConfirmHost } from "@/components/ui/confirm";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald", weight: ["500", "600", "700"], display: "swap" });

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
  themeColor: "#090909",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable} dark`}>
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
