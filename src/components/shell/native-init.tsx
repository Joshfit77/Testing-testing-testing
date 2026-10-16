"use client";
import { useEffect } from "react";
import { initNativeShell } from "@/lib/native";

export function NativeInit() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void initNativeShell().then((c) => (cleanup = c));
    return () => cleanup?.();
  }, []);
  return null;
}
