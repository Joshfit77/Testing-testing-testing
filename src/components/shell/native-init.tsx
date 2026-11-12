"use client";
import "@/lib/zod-browser";
import { useEffect } from "react";
import { initNativeShell } from "@/lib/native";
import { installSleepAlarmActions, syncSleepAlarmFromAccount } from "@/lib/native-alarm";
import { installReminderTapHandler } from "@/lib/native-notifications";
import { getSleepAlarmConfigAction } from "@/server/actions/sleep";

export function NativeInit() {
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    void initNativeShell().then((c) => cleanups.push(c));
    void installSleepAlarmActions().then((c) => cleanups.push(c));
    // Tapping a reminder opens its screen (also when the tap is what launched the app).
    void installReminderTapHandler().then((c) => cleanups.push(c));
    void syncSleepAlarmFromAccount(getSleepAlarmConfigAction);
    return () => cleanups.forEach((c) => c());
  }, []);
  return null;
}
