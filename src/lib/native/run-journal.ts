"use client";

/**
 * The app's own native run journal (ios/App/App/RunJournalPlugin.swift, android/.../runjournal/RunJournalPlugin.java).
 *
 * While a run or walk records in the phone app, native code writes every GPS fix to a file as it arrives, with no
 * JavaScript involved, so the route survives the web view being suspended or the app being ended with the phone
 * locked (O-01). The web app reads it back when it offers to continue an unfinished recording, and clears it when the
 * recording is saved or discarded, at sign-out and at account deletion. Every function is a safe no-op in a browser
 * or in an app build without the plugin.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { GpsFix } from "@/lib/domain/gps-track";

interface RunJournalNative {
  start(options: { key: string }): Promise<{ recording: boolean; authorized: boolean }>;
  status(): Promise<{ active: boolean; key?: string }>;
  ensurePermission(): Promise<{ granted: boolean }>;
  stop(): Promise<void>;
  read(options: { key: string }): Promise<{ fixes: GpsFix[] }>;
  clear(options: { key?: string }): Promise<void>;
}

const RunJournal = registerPlugin<RunJournalNative>("RunJournal");

export function hasNativeRunJournal(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("RunJournal");
}

/** Start writing fixes natively for the recording stored under `key`. Never throws. */
export async function startNativeRunJournal(key: string): Promise<boolean> {
  if (!hasNativeRunJournal()) return false;
  try {
    return (await RunJournal.start({ key })).recording;
  } catch {
    return false;
  }
}

/** Stop writing (the file stays until the recording is saved, discarded or cleared). Never throws. */
export async function stopNativeRunJournal(): Promise<void> {
  if (!hasNativeRunJournal()) return;
  try {
    await RunJournal.stop();
  } catch {
    /* nothing running */
  }
}

/** Every fix written natively for `key`, oldest first; empty when there are none or no plugin. */
export async function readNativeRunJournal(key: string): Promise<GpsFix[]> {
  if (!hasNativeRunJournal()) return [];
  try {
    const { fixes } = await RunJournal.read({ key });
    return Array.isArray(fixes) ? fixes.filter((f) => Number.isFinite(f?.lat) && Number.isFinite(f?.lng) && Number.isFinite(f?.t)) : [];
  } catch {
    return [];
  }
}

/** Remove one recording's native journal, or all of them (sign-out, account deletion). Never throws. */
export async function clearNativeRunJournal(key?: string): Promise<void> {
  if (!hasNativeRunJournal()) return;
  try {
    await RunJournal.clear(key ? { key } : {});
  } catch {
    /* nothing stored */
  }
}

/**
 * Android: ask for location before the background watcher starts (works around the plugin starting its foreground
 * service before the prompt is answered on Android 14+). True when granted, or when there's nothing to ask here.
 */
export async function ensureNativeLocationPermission(): Promise<boolean> {
  if (!hasNativeRunJournal() || Capacitor.getPlatform() !== "android") return true;
  try {
    return (await RunJournal.ensurePermission()).granted;
  } catch {
    return true; // the watcher's own prompt still runs
  }
}

/**
 * At app start: a native journal still recording for a recording that can't be continued here (none saved, or
 * finished) is stopped, so a run abandoned after a crash doesn't keep the GPS on. One that can be continued is left
 * running: the member's route keeps being recorded until they reopen the run and continue it.
 */
export async function reconcileNativeRunJournal(canContinue: (key: string) => boolean): Promise<"none" | "kept" | "stopped"> {
  if (!hasNativeRunJournal()) return "none";
  try {
    const { active, key } = await RunJournal.status();
    if (!active || !key) return "none";
    if (canContinue(key)) return "kept";
    await RunJournal.stop();
    return "stopped";
  } catch {
    return "none";
  }
}
