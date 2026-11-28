/**
 * Links between Biblical AI and the Bible reader (pure; client and server).
 *
 * A reference opened from Biblical AI opens the reader in "peek" mode (`from=ai`): the reader doesn't record it as
 * the member's reading position, and shows a way back. The way back is only ever a Biblical AI path (never another
 * site or page), so a crafted link can't redirect anywhere else.
 */
import { bookById } from "@/lib/bible/books";
import { findReferences } from "@/lib/bible/ai";
import { formatReference, parseReference, type ScriptureRef } from "@/lib/bible/reference";
import type { CategoryId, Depth } from "./config";

/** A Biblical AI path to come back to, or null. Only /faith/biblical-ai paths, no scheme, host or protocol-relative. */
export function safeBack(back: string | null | undefined): string | null {
  if (!back || back.length > 500) return null;
  if (!/^\/faith\/biblical-ai(?:[/?#]|$)/.test(back)) return null;
  if (/^\/\/|\\|[\u0000-\u001f]/.test(back) || /^\/faith\/biblical-ai\/\//.test(back)) return null;
  return back;
}

/** The reader at a reference, opened from Biblical AI (peek mode, with the way back). */
export function readerHref(ref: ScriptureRef, back?: string | null): string {
  const b = bookById(ref.bookId);
  if (!b) return "/faith/bible";
  const v = ref.verseStart;
  const q = new URLSearchParams();
  if (v) q.set("v", String(v));
  q.set("from", "ai");
  const ok = safeBack(back ?? null);
  if (ok) q.set("back", ok);
  return `/faith/bible/${b.slug}/${ref.chapter}?${q.toString()}${v ? `#v${v}` : ""}`;
}

/** A reference string → reader link, or null when it isn't a real reference. */
export function referenceHref(reference: string, back?: string | null): string | null {
  const ref = parseReference(reference);
  return ref ? readerHref(ref, back) : null;
}

export function askHref(opts: { category?: CategoryId; q?: string; passage?: string; depth?: Depth; conversation?: string; share?: string }): string {
  const q = new URLSearchParams();
  if (opts.conversation) q.set("c", opts.conversation);
  if (opts.category) q.set("category", opts.category);
  if (opts.depth) q.set("depth", opts.depth);
  if (opts.passage) q.set("passage", opts.passage);
  if (opts.q) q.set("q", opts.q.slice(0, 600));
  if (opts.share) q.set("share", opts.share);
  const s = q.toString();
  return `/faith/biblical-ai/ask${s ? `?${s}` : ""}`;
}

export type Segment = { text: string } | { text: string; href: string; reference: string };

/**
 * Split prose into text and Scripture references, so every reference is a link. `exists` decides whether a reference
 * is real (the server's BSB check, or the verified list that came with the answer); others stay plain text.
 */
export function linkReferences(text: string, exists: (reference: string) => boolean, back?: string | null): Segment[] {
  const out: Segment[] = [];
  let rest = text;
  for (const { raw, ref } of findReferences(text)) {
    if (!ref) continue;
    const reference = formatReference(ref);
    if (!exists(reference)) continue;
    const i = rest.indexOf(raw);
    if (i < 0) continue;
    if (i > 0) out.push({ text: rest.slice(0, i) });
    out.push({ text: raw, href: readerHref(ref, back), reference });
    rest = rest.slice(i + raw.length);
  }
  if (rest) out.push({ text: rest });
  return out;
}
