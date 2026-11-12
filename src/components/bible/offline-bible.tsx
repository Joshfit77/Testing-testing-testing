"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CloudDownload, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { isNativeApp } from "@/lib/native";

/** Must match BIBLE_CACHE in public/sw.js. */
export const BIBLE_CACHE = "ngf-bible-v1";
const SHELL = ["/bible-offline.html", "/bible-offline.js", "/bible/bsb/meta.json", "/bible/bsb/wj.json"];

type Status = { kind: "checking" } | { kind: "unsupported" } | { kind: "native" } | { kind: "none" } | { kind: "partial"; have: number } | { kind: "saved" } | { kind: "saving"; done: number } | { kind: "error"; message: string };

/**
 * "Save the Bible for offline": stores the public-domain BSB text (about 4 MB) and the offline reader in the browser's
 * cache, where the service worker serves it when there is no connection. Nothing private is stored. In the native app
 * the Bible is bundled with the app instead.
 */
export function OfflineBible({ bookIds }: { bookIds: string[] }) {
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const urls = [...SHELL, ...bookIds.map((id) => `/bible/bsb/books/${id}.json`)];

  useEffect(() => {
    if (isNativeApp()) return setStatus({ kind: "native" });
    if (!("caches" in window) || !("serviceWorker" in navigator)) return setStatus({ kind: "unsupported" });
    let live = true;
    void (async () => {
      try {
        const cache = await caches.open(BIBLE_CACHE);
        const keys = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
        const have = urls.filter((u) => keys.has(u)).length;
        if (live) setStatus(have === urls.length ? { kind: "saved" } : have ? { kind: "partial", have } : { kind: "none" });
      } catch {
        if (live) setStatus({ kind: "unsupported" });
      }
    })();
    return () => {
      live = false;
    };
    // urls is derived from bookIds, which never changes for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setStatus({ kind: "saving", done: 0 });
    try {
      const cache = await caches.open(BIBLE_CACHE);
      let done = 0;
      // A few at a time, so a phone on a slow connection isn't flooded.
      const queue = [...urls];
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          for (let u = queue.shift(); u; u = queue.shift()) {
            const res = await fetch(u, { cache: "no-cache", credentials: "omit" });
            if (!res.ok) throw new Error(`${u}: ${res.status}`);
            await cache.put(u, res);
            setStatus({ kind: "saving", done: ++done });
          }
        }),
      );
      setStatus({ kind: "saved" });
    } catch {
      setStatus({ kind: "error", message: "Couldn't save everything. Check your connection and try again; what was saved is kept." });
    }
  }

  async function remove() {
    await caches.delete(BIBLE_CACHE);
    setStatus({ kind: "none" });
  }

  if (status.kind === "checking") return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="offline-bible-title">
      <h2 id="offline-bible-title" className="flex items-center gap-2 font-semibold">
        <CloudDownload className="size-5 text-gold" aria-hidden /> Read without a connection
      </h2>
      {status.kind === "native" ? (
        <p className="mt-1 text-sm text-muted-foreground">The whole Bible comes with the app. If you lose your connection, choose Read the Bible on the offline screen.</p>
      ) : status.kind === "unsupported" ? (
        <p className="mt-1 text-sm text-muted-foreground">This browser can&rsquo;t keep the Bible for offline reading. The Narrow Gate app includes it.</p>
      ) : status.kind === "saved" ? (
        <div className="mt-1 space-y-2">
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 shrink-0 text-gold" aria-hidden /> Saved on this device. Without a connection, Bible pages open from here (text only; your highlights and notes need a connection).
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => void remove()}>
            <Trash2 aria-hidden /> Remove from this device
          </Button>
        </div>
      ) : status.kind === "saving" ? (
        <div className="mt-2 space-y-2" aria-live="polite">
          <p className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin text-gold" aria-hidden /> Saving {status.done} of {urls.length}…
          </p>
          <ProgressBar value={(status.done / urls.length) * 100} label="Saving the Bible" />
        </div>
      ) : (
        <div className="mt-1 space-y-2">
          <p className="text-sm text-muted-foreground">
            Keep the complete Berean Standard Bible on this device (about 4 MB) so you can read it anywhere. Only the Bible text is saved, nothing from your account.
            {status.kind === "partial" ? ` ${status.have} of ${urls.length} parts are saved.` : ""}
          </p>
          {status.kind === "error" && (
            <p className="text-sm text-destructive" role="alert">
              {status.message}
            </p>
          )}
          <Button type="button" variant="secondary" onClick={() => void save()}>
            <CloudDownload aria-hidden /> {status.kind === "partial" || status.kind === "error" ? "Finish saving" : "Save for offline"}
          </Button>
        </div>
      )}
    </section>
  );
}
