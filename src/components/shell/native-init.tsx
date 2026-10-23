"use client";
import { useEffect } from "react";
import { initNativeShell } from "@/lib/native";
import { installSleepAlarmActions } from "@/lib/native-alarm";

export function NativeInit() {
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    void initNativeShell().then((c) => cleanups.push(c));
    void installSleepAlarmActions().then((c) => cleanups.push(c));
    return () => cleanups.forEach((c) => c());
  }, []);
  return null;
}
