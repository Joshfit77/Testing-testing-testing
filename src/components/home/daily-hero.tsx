"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { HOME_BACKGROUNDS, HOME_BACKGROUND_PHOTOS_READY, deviceIsoDate, homeBackgroundForDate, msUntilNextLocalMidnight, type HomeBackground } from "@/lib/home-backgrounds";

const Ctx = createContext<HomeBackground | null>(null);

/**
 * The Home hero: the day's background (one for each weekday) behind the greeting and the verse.
 *
 * The server paints the picture for the member's "today" (`today`, in their saved time zone). After that the hero
 * follows the phone's own clock: when the phone's date is no longer the one on screen (midnight passed, the app came
 * back from the background on another day, the phone changed time zone) it switches the picture at once, which needs
 * no connection, and asks the page to refresh so the date, the verse and today's workout catch up too.
 *
 * Decorative: the picture is aria-hidden and the children carry the meaning. A dark gradient keeps white text legible.
 */
export function DailyHero({ today, children, className, minHeight = "min-h-[21rem]" }: { today: string; children: React.ReactNode; className?: string; minHeight?: string }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  // The picture that could not be loaded, if any. Kept by day, so the next day's picture (or a retry) is not blocked.
  const [failedKey, setFailedKey] = useState<string | null>(null);
  // The server's date changed (a refresh): show it.
  const [seen, setSeen] = useState(today);
  if (seen !== today) {
    setSeen(today);
    setDate(today);
    setFailedKey(null);
  }
  const serverRef = useRef(today);
  const askedFor = useRef<string | null>(null);
  useEffect(() => {
    serverRef.current = today;
  }, [today]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const local = deviceIsoDate();
      setDate((shown) => (shown === local ? shown : local));
      // One refresh for each new device date, so a phone whose zone differs from the saved one doesn't refresh forever.
      if (local !== serverRef.current && askedFor.current !== local && navigator.onLine !== false) {
        askedFor.current = local;
        router.refresh();
      }
      clearTimeout(timer);
      timer = setTimeout(check, msUntilNextLocalMidnight());
    };
    check();
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    // Back online: try a picture that failed to load again.
    const onOnline = () => { setFailedKey(null); check(); };
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  // Fetch the other six pictures once the page is idle (about 230 kB in total), so the next day's picture is already
  // on the phone at midnight or after a resume without a connection.
  useEffect(() => {
    if (!HOME_BACKGROUND_PHOTOS_READY) return;
    const warm = () => { for (const b of HOME_BACKGROUNDS) new Image().src = b.src; };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(warm, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(warm, 2500);
    return () => clearTimeout(t);
  }, []);

  const bg = homeBackgroundForDate(date);
  const failed = failedKey === bg.key;
  // A picture that failed before the page became interactive fired its error event too early to be heard.
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailedKey(bg.key);
  }, [bg.key]);
  return (
    <Ctx.Provider value={bg}>
      <div className={cn("relative isolate overflow-hidden bg-[#0a0705]", minHeight, className)} data-testid="home-hero" data-day={bg.key}>
        {/* Shown if the picture can't load (offline before it was ever fetched): the same warm light, drawn in CSS. */}
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_70%_at_72%_36%,rgba(214,160,74,0.34),rgba(120,70,20,0.12)_45%,transparent_75%)]" />
        {HOME_BACKGROUND_PHOTOS_READY && !failed && (
          // eslint-disable-next-line @next/next/no-img-element -- a fixed-size local asset behind text; next/image adds nothing here
          <img
            key={bg.key}
            ref={imgRef}
            src={bg.src}
            alt=""
            aria-hidden
            decoding="async"
            fetchPriority="high"
            onError={() => setFailedKey(bg.key)}
            // A fixed height, not the hero's: the hero grows with the verse, and a picture that grew with it would be
            // cropped differently every day. Its lower edge fades into the panel.
            className={cn(
              "absolute inset-x-0 top-0 h-[26rem] w-full object-cover object-[70%_40%] [mask-image:linear-gradient(to_bottom,black_72%,transparent)]",
              // Fade only when the day changes under an open page. The first picture is in the server's HTML and is the
              // largest thing on screen; fading it in held back the page's largest paint by the length of the fade.
              date !== today && "motion-safe:animate-[fade-in_0.5s_ease-out]",
            )}
          />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-[#070707]" />
        {/* The greeting and the verse sit on the left two thirds: darkest there, clear over the subject on the right. */}
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.5)_45%,rgba(0,0,0,0.24)_68%,transparent_88%)]" />
        <div className="relative">{children}</div>
      </div>
    </Ctx.Provider>
  );
}

/** The day's theme ("Perseverance"), for a short line inside the hero. */
export function DailyTheme({ className }: { className?: string }) {
  const bg = useContext(Ctx);
  if (!bg) return null;
  return (
    <p className={className} data-testid="home-theme">
      {bg.theme}
    </p>
  );
}
