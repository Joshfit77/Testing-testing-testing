/**
 * Turns a YouTube or Vimeo page link into its privacy-friendly embed URL.
 * Returns null for anything else (e.g. a direct .mp4 link, which plays in <video>).
 */
export function videoEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const id = (s: string | null | undefined, re: RegExp) => (s && re.test(s) ? s : null);
  const yt = /^[A-Za-z0-9_-]{6,20}$/;
  let ytId: string | null = null;
  if (host === "youtu.be") ytId = id(url.pathname.slice(1).split("/")[0], yt);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") ytId = id(url.searchParams.get("v"), yt);
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
      ytId = id(m?.[1], yt);
    }
  }
  if (ytId) return `https://www.youtube-nocookie.com/embed/${ytId}?rel=0`;
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = url.pathname.match(/(?:^|\/)(\d{5,12})(?:$|\/)/);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  }
  return null;
}

/** A YouTube search for good-form demonstrations of an exercise (opens outside the app). */
export function formVideoSearchUrl(exerciseName: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exerciseName} proper form`)}`;
}
