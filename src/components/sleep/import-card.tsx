"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HEALTH_APP_NAME, healthSyncPlatform, type HealthPlatform } from "@/lib/native-health";
import { readRecentSleep } from "@/lib/native-sleep";
import { importSleepAction } from "@/server/actions/sleep-import";

/** Reads sleep from the phone's health platform and sends it to the server, reporting exactly what was added. */
export function SleepImportCard({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [platform, setPlatform] = useState<HealthPlatform | null | undefined>(undefined);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setPlatform(healthSyncPlatform()), []);

  if (platform === undefined) return <p className="text-sm text-muted-foreground">Checking this device…</p>;
  if (!platform) {
    return <p className="text-sm text-muted-foreground">Automatic import works in the Narrow Gate phone app, which reads sleep (and sleep stages, where your watch records them) from Apple Health or Health Connect. On the web, use the timer or enter nights by hand.</p>;
  }
  const appName = HEALTH_APP_NAME[platform];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Reads the last 14 days of sleep from {appName}, including stages where your watch recorded them. Records already imported are skipped, and anything overlapping an entry you made is left out rather than merged. Nothing is written back to {appName}.
      </p>
      <Button
        type="button"
        disabled={!enabled || pending}
        aria-busy={pending}
        onClick={() =>
          start(async () => {
            setMessage(null);
            const read = await readRecentSleep(14);
            if (!read.ok) {
              setMessage({ ok: false, text: read.message });
              return;
            }
            const res = await importSleepAction({ source: read.source, timezone: read.timezone, rangeStart: read.rangeStart, rangeEnd: read.rangeEnd, sessions: read.sessions });
            setMessage({ ok: res.ok, text: res.message ?? (res.ok ? "Done." : "Couldn't import.") });
            if (res.ok) router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />} Import from {appName}
      </Button>
      {!enabled && <p className="text-xs text-muted-foreground">Import is switched off. Turn it on below to read from {appName} again.</p>}
      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-success" : "text-sm text-destructive-foreground"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
