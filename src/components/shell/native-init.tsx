"use client";
import "@/lib/zod-browser";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NAVIGATE_EVENT } from "@/lib/in-app-navigation";
import { reconcileNativeRunJournal } from "@/lib/native/run-journal";
import { isRecoverable } from "@/lib/domain/gps-track";
import { initNativeShell } from "@/lib/native";
import { installSleepAlarmActions, syncSleepAlarmFromAccount } from "@/lib/native-alarm";
import { installReminderTapHandler } from "@/lib/native-notifications";
import { removeOrphanedWatchers } from "@/lib/native/location";
import { getSleepAlarmConfigAction } from "@/server/actions/sleep";

/** Whether the recording saved under `key` on this device can still be continued (a native journal may keep going). */
function canContinueRecording(key: string): boolean {
  try {
    const raw = localStorage.getItem(key);
    const track: unknown = raw ? (JSON.parse(raw) as { track?: unknown }).track : null;
    return isRecoverable(track, Date.now()) && track.status !== "finished";
  } catch {
    return false;
  }
}

export function NativeInit() {
  const router = useRouter();
  // Navigation started by native code (reminder taps, "I'm up", app links) stays inside the page (in-app-navigation.ts).
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const path = (e as CustomEvent<string>).detail;
      if (typeof path !== "string" || !path.startsWith("/")) return;
      e.preventDefault();
      router.push(path);
    };
    window.addEventListener(NAVIGATE_EVENT, onNavigate);
    return () => window.removeEventListener(NAVIGATE_EVENT, onNavigate);
  }, [router]);

  useEffect(() => {
    const cleanups: (() => void)[] = [];
    void initNativeShell().then((c) => cleanups.push(c));
    void installSleepAlarmActions().then((c) => cleanups.push(c));
    // Tapping a reminder opens its screen (also when the tap is what launched the app).
    void installReminderTapHandler().then((c) => cleanups.push(c));
    void syncSleepAlarmFromAccount(getSleepAlarmConfigAction);
    // A GPS watcher left running by an earlier page (the web view reloaded mid-run) is stopped (O-03).
    void removeOrphanedWatchers();
    // A native run journal left recording with nothing to continue (a recording abandoned after a crash) is stopped.
    void reconcileNativeRunJournal(canContinueRecording);
    return () => cleanups.forEach((c) => c());
  }, []);
  return null;
}
