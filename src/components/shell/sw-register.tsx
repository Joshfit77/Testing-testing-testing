"use client";
import { useEffect } from "react";
import { isNativeApp } from "@/lib/native";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || isNativeApp()) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* Registration failure is non-fatal; the app works without offline support. */
    });
  }, []);
  return null;
}
