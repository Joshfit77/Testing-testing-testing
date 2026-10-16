import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Narrow Gate Fitness",
    short_name: "Narrow Gate",
    description: "Rooted in faith. Built for strength. Training programs, workout tracking, nutrition and AI coaching.",
    start_url: "/home?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#090909",
    theme_color: "#090909",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Start workout", url: "/train/workout", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Log food", url: "/nutrition", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "AI coach", url: "/coach", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
