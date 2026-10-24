"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, RefreshCw, Smartphone, Watch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PULL_REFRESH_EVENT } from "@/components/platform/pull-to-refresh";
import { IMPORT_SOURCE_LABEL } from "@/lib/domain/sleep-import";
import { HEALTH_APP_NAME, healthSyncPlatform, type HealthPlatform } from "@/lib/native-health";
import { readRecentSleep, SLEEP_VITAL_LABEL } from "@/lib/native-sleep";
import { importSleepAction } from "@/server/actions/sleep-import";

export interface SleepSourceStatus {
  /** The platform the member connected (null until the first successful sync). */
  source: "apple_health" | "health_connect" | null;
  connectedAt: string | null;
  importEnabled: boolean;
  /** The latest sync, from the import records. */
  lastSync: { at: string; device: string | null; added: number; updated: number; withVitals: number } | null;
  /** The device named on the most recent imported night. */
  deviceName: string | null;
  timeZone: string;
}

/** A sync older than this is refreshed when the app opens or the member pulls the page down. */
const STALE_MS = 30 * 60_000;

function ago(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 36) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
}

/**
 * The connected health source: where the sleep comes from, when it last synced, and a way to sync now. In the phone
 * app it also syncs by itself when the app opens with a stale sync, and on pull-to-refresh. On the web it says how
 * to connect, because a browser can't read Apple Health or Health Connect.
 */
export function SleepSourceCard({ status }: { status: SleepSourceStatus }) {
  const router = useRouter();
  const [platform, setPlatform] = useState<HealthPlatform | null | undefined>(undefined);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const syncing = useRef(false);

  const sync = useCallback(
    (auto: boolean) => {
      if (syncing.current) return;
      syncing.current = true;
      start(async () => {
        try {
          setMessage(null);
          const read = await readRecentSleep(14);
          if (!read.ok) {
            if (!auto) setMessage({ ok: false, text: read.message });
            return;
          }
          const res = await importSleepAction({ source: read.source, timezone: read.timezone, rangeStart: read.rangeStart, rangeEnd: read.rangeEnd, sessions: read.sessions });
          const denied = read.vitalsDenied.length ? ` ${read.vitalsDenied.map((t) => SLEEP_VITAL_LABEL[t]).join(", ")} not allowed on this phone.` : "";
          setMessage({ ok: res.ok, text: `${res.message ?? (res.ok ? "Synced." : "Couldn't sync.")}${denied}` });
          setNow(Date.now());
          if (res.ok) router.refresh();
        } finally {
          syncing.current = false;
        }
      });
    },
    [router],
  );

  useEffect(() => {
    const p = healthSyncPlatform();
    setPlatform(p);
    if (!p || !status.importEnabled) return;
    const stale = !status.lastSync || Date.now() - Date.parse(status.lastSync.at) > STALE_MS;
    if (stale) sync(true);
    // Coming back to the app (Capacitor resumes fire visibilitychange) re-checks staleness; a pull always syncs.
    const onVisible = () => {
      if (document.visibilityState === "visible" && (!status.lastSync || Date.now() - Date.parse(status.lastSync.at) > STALE_MS)) sync(true);
    };
    const onPull = () => sync(false);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(PULL_REFRESH_EVENT, onPull);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(PULL_REFRESH_EVENT, onPull);
    };
  }, [status.importEnabled, status.lastSync, sync]);

  const card = "rounded-2xl border border-gold-muted/60 bg-card-gradient p-4";
  const connected = Boolean(status.source && status.importEnabled);
  const sourceName = status.source ? IMPORT_SOURCE_LABEL[status.source] : null;
  const deviceLine = status.deviceName ?? status.lastSync?.device ?? null;

  if (platform === undefined) {
    return (
      <section className={card} aria-labelledby="source-title">
        <h2 id="source-title" className="sr-only">
          Connected source
        </h2>
        <p className="text-sm text-muted-foreground">Checking this device…</p>
      </section>
    );
  }

  return (
    <section className={card} aria-labelledby="source-title" data-testid="sleep-source">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold-muted/60 bg-elevated">
          {platform ? <Watch className="size-5 text-gold" aria-hidden /> : <Smartphone className="size-5 text-gold" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="source-title" className="font-display text-base font-bold uppercase">
            {connected ? `${deviceLine ?? "Wearable"} via ${sourceName}` : platform ? `Connect ${HEALTH_APP_NAME[platform]}` : "Connect your watch"}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {connected && status.lastSync
              ? `Last synced ${ago(status.lastSync.at, now)}${status.lastSync.added ? ` · ${status.lastSync.added} new` : ""}${status.lastSync.withVitals ? " · with overnight measurements" : ""}`
              : connected
                ? "Connected; no sync recorded yet."
                : platform
                  ? `Sleep, stages and overnight heart rate, HRV and breathing from any watch or ring that writes to ${HEALTH_APP_NAME[platform]} (Apple Watch, Oura, Garmin, WHOOP and more).`
                  : "In the Narrow Gate phone app, connect Apple Health or Health Connect once and every night your watch records appears here by itself, stages and overnight heart rate included. On the web, use the timer or enter nights by hand."}
          </p>
          {connected && !status.importEnabled && <p className="mt-1 text-xs text-muted-foreground">Import is switched off; nothing new is read from this phone.</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {platform && (
          <Button type="button" size="sm" onClick={() => sync(false)} disabled={pending || !status.importEnabled} aria-busy={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />} {connected ? "Sync now" : `Connect ${HEALTH_APP_NAME[platform]}`}
          </Button>
        )}
        <Button asChild size="sm" variant="secondary">
          <Link href="/progress/sleep/settings#devices">{connected ? "Manage" : "Connection settings"}</Link>
        </Button>
        {!platform && !connected && (
          <Button asChild size="sm" variant="ghost">
            <Link href="/progress/sleep/log">Or enter a night by hand</Link>
          </Button>
        )}
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "mt-2 text-sm text-success" : "mt-2 text-sm text-destructive-foreground"}>
          {message.text}
        </p>
      )}
    </section>
  );
}
