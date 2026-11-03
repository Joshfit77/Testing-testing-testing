"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Brain, Copy, Minus, NotebookPen, Plus, Share2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { selectionReference, shareableText, verseRange, verseRuns } from "@/lib/bible/format";
import { cn } from "@/lib/utils";
import {
  addMemoryVerseAction,
  deleteBibleNoteAction,
  recordChapterViewAction,
  saveBibleNoteAction,
  setFontScaleAction,
  setHighlightAction,
  toggleBookmarkAction,
  type HighlightColor,
} from "@/server/actions/bible";

export interface ReaderNote {
  id: string;
  verseStart: number;
  verseEnd: number;
  body: string;
  updatedAt: string;
}

const COLORS: { id: HighlightColor; label: string; swatch: string; mark: string }[] = [
  { id: "gold", label: "Gold", swatch: "bg-[#C9A54C]", mark: "bg-[#C9A54C]/25" },
  { id: "sage", label: "Sage", swatch: "bg-[#7FA37A]", mark: "bg-[#7FA37A]/25" },
  { id: "sky", label: "Sky", swatch: "bg-[#6E9CC4]", mark: "bg-[#6E9CC4]/25" },
  { id: "rose", label: "Rose", swatch: "bg-[#C47A86]", mark: "bg-[#C47A86]/25" },
];
const MARK = Object.fromEntries(COLORS.map((c) => [c.id, c.mark])) as Record<HighlightColor, string>;

const FONT_STEPS = [0.85, 0.95, 1, 1.1, 1.2, 1.35, 1.5, 1.65, 1.8];
const FONT_KEY = "ngf.bible.fontScale";

/**
 * One chapter of the BSB, verse by verse. Tap verses to select them, then highlight, bookmark, add a note, copy,
 * share or save them to memory. Text is shown exactly as stored; nothing here changes a word.
 */
export function ChapterReader(props: {
  bookId: string;
  chapter: number;
  verses: [number, string][];
  withoutText: number[];
  highlights: Record<number, HighlightColor>;
  bookmarks: number[];
  chapterBookmarked: boolean;
  notes: ReaderNote[];
  fontScale: number;
  focusVerse: number | null;
}) {
  const { bookId, chapter, verses } = props;
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [highlights, setHighlights] = useState(props.highlights);
  const [bookmarks, setBookmarks] = useState(() => new Set(props.bookmarks));
  const [chapterBookmarked, setChapterBookmarked] = useState(props.chapterBookmarked);
  const [scale, setScale] = useState(props.fontScale);
  const [noteOpen, setNoteOpen] = useState<{ id: string | null; start: number; end: number; body: string } | null>(null);
  const [viewNotes, setViewNotes] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const fontTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const text = useMemo(() => new Map(verses), [verses]);
  const ref = selectionReference(bookId, chapter, selected);

  // Remember the chapter (Continue Reading + history) once it has been open a second, not on a rapid tap-through.
  useEffect(() => {
    const t = setTimeout(() => void recordChapterViewAction(bookId, chapter, props.focusVerse), 1000);
    return () => clearTimeout(t);
  }, [bookId, chapter, props.focusVerse]);

  // The member's text size on this device applies at once; the saved one follows them to other devices.
  useEffect(() => {
    try {
      const local = Number(localStorage.getItem(FONT_KEY));
      if (local >= 0.8 && local <= 1.8 && local !== props.fontScale) setScale(local);
    } catch {
      /* storage unavailable */
    }
  }, [props.fontScale]);

  useEffect(() => {
    if (!props.focusVerse) return;
    document.getElementById(`v${props.focusVerse}`)?.scrollIntoView({ block: "center" });
  }, [props.focusVerse]);

  useEffect(() => {
    if (!selected.length) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected([]);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.length]);

  function changeFont(dir: 1 | -1) {
    const i = FONT_STEPS.findIndex((s) => s >= scale - 0.001);
    const next = FONT_STEPS[Math.min(FONT_STEPS.length - 1, Math.max(0, (i < 0 ? 2 : i) + dir))]!;
    setScale(next);
    try {
      localStorage.setItem(FONT_KEY, String(next));
    } catch {
      /* storage unavailable */
    }
    if (fontTimer.current) clearTimeout(fontTimer.current);
    fontTimer.current = setTimeout(() => void setFontScaleAction(next, bookId, chapter), 800);
  }

  const toggle = (v: number) => setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v].sort((a, b) => a - b)));

  function highlight(color: HighlightColor | null) {
    const vs = selected;
    const before = highlights;
    setHighlights((h) => {
      const next = { ...h };
      for (const v of vs) {
        if (color) next[v] = color;
        else delete next[v];
      }
      return next;
    });
    setSelected([]);
    start(async () => {
      const r = await setHighlightAction(bookId, chapter, vs, color);
      if (!r.ok) {
        setHighlights(before);
        toast.error(r.error);
      }
    });
  }

  function bookmark() {
    const v = selected.length ? selected[0]! : null;
    start(async () => {
      const r = await toggleBookmarkAction(bookId, chapter, v);
      if (!r.ok) return toast.error(r.error);
      if (v === null) setChapterBookmarked(Boolean(r.bookmarked));
      else
        setBookmarks((b) => {
          const n = new Set(b);
          if (r.bookmarked) n.add(v);
          else n.delete(v);
          return n;
        });
      toast.success(r.bookmarked ? `Bookmarked ${v === null ? selectionReference(bookId, chapter, []) : selectionReference(bookId, chapter, [v])}` : "Bookmark removed");
      setSelected([]);
    });
  }

  async function copy() {
    const t = shareableText(bookId, chapter, selected.map((v) => [v, text.get(v) ?? ""]));
    try {
      await navigator.clipboard.writeText(t);
      toast.success(`Copied ${ref}`);
      setSelected([]);
    } catch {
      toast.error("Couldn't copy on this device. Press and hold the verse text to copy it instead.");
    }
  }

  async function share() {
    const t = shareableText(bookId, chapter, selected.map((v) => [v, text.get(v) ?? ""]));
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: t });
        setSelected([]);
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    await copy();
  }

  function memorize() {
    const runs = verseRuns(selected);
    if (runs.length !== 1) return toast.info("Choose verses next to each other to memorize them together.");
    const [a, b] = runs[0]!;
    if (b - a >= 30) return toast.info("Choose up to 30 verses to memorize at once.");
    start(async () => {
      const r = await addMemoryVerseAction(bookId, chapter, a, b);
      if (!r.ok) return toast.error(r.error);
      toast.success(`${ref} saved to Scripture memory`);
      setSelected([]);
    });
  }

  function openNote() {
    const runs = verseRuns(selected);
    const s = runs[0]?.[0] ?? 1;
    const e = runs.at(-1)?.[1] ?? s;
    setNoteOpen({ id: null, start: s, end: e, body: "" });
  }

  const notesByVerse = useMemo(() => {
    const m = new Map<number, ReaderNote[]>();
    for (const n of props.notes) {
      const list = m.get(n.verseEnd) ?? [];
      list.push(n);
      m.set(n.verseEnd, list);
    }
    return m;
  }, [props.notes]);

  // Verses the BSB keeps without text sit in their place, marked as such, so the numbering reads truthfully.
  const rows: ({ kind: "verse"; v: number; t: string } | { kind: "gap"; v: number })[] = [
    ...verses.map(([v, t]) => ({ kind: "verse" as const, v, t })),
    ...props.withoutText.map((v) => ({ kind: "gap" as const, v })),
  ].sort((a, b) => a.v - b.v);

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-1" role="group" aria-label="Text size">
        <Button type="button" variant="ghost" size="icon" onClick={() => changeFont(-1)} disabled={scale <= FONT_STEPS[0]!} aria-label="Smaller text">
          <Minus aria-hidden />
        </Button>
        <span className="w-12 text-center text-sm tabular-nums text-muted-foreground" aria-live="polite">
          {Math.round(scale * 100)}%
        </span>
        <Button type="button" variant="ghost" size="icon" onClick={() => changeFont(1)} disabled={scale >= FONT_STEPS.at(-1)!} aria-label="Larger text">
          <Plus aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-pressed={chapterBookmarked}
          aria-label={chapterBookmarked ? "Remove chapter bookmark" : "Bookmark this chapter"}
          onClick={() => {
            setSelected([]);
            start(async () => {
              const r = await toggleBookmarkAction(bookId, chapter, null);
              if (!r.ok) return toast.error(r.error);
              setChapterBookmarked(Boolean(r.bookmarked));
              toast.success(r.bookmarked ? "Chapter bookmarked" : "Bookmark removed");
            });
          }}
        >
          {chapterBookmarked ? <BookmarkCheck className="text-gold" aria-hidden /> : <Bookmark aria-hidden />}
        </Button>
      </div>

      <div className="mx-auto max-w-[38rem] font-serif leading-[1.8]" style={{ fontSize: `calc(1.125rem * ${scale})` }} data-testid="bible-text">
        {rows.map((r) =>
          r.kind === "gap" ? (
            <p key={`g${r.v}`} id={`v${r.v}`} className="my-1 rounded-lg border border-dashed border-border px-3 py-1.5 font-sans text-sm text-muted-foreground">
              <sup className="mr-1 font-semibold text-gold">{r.v}</sup>
              Verse {r.v} is not in the Berean Standard Bible&rsquo;s main text; the translation gives it in a footnote, which this app does not show.
            </p>
          ) : (
            <p key={r.v} id={`v${r.v}`} className="scroll-mt-24">
              <button
                type="button"
                onClick={() => toggle(r.v)}
                aria-pressed={selected.includes(r.v)}
                className={cn(
                  "-mx-1.5 w-[calc(100%+0.75rem)] rounded-md px-1.5 py-0.5 text-left transition-colors",
                  highlights[r.v] && MARK[highlights[r.v]!],
                  selected.includes(r.v) && "underline decoration-gold decoration-2 underline-offset-4 ring-1 ring-gold/60",
                  props.focusVerse === r.v && !selected.length && "animate-[verse-focus_2.4s_ease-out]",
                )}
              >
                <sup className="mr-1 select-none font-sans text-[0.65em] font-semibold text-gold" aria-label={`Verse ${r.v}`}>
                  {r.v}
                </sup>
                {r.t}
                {bookmarks.has(r.v) && <Bookmark className="ml-1 inline size-[0.8em] fill-gold text-gold" aria-label="Bookmarked" />}
              </button>
              {notesByVerse.has(r.v) && (
                <button type="button" onClick={() => setViewNotes(r.v)} className="ml-1 inline-flex min-h-8 items-center gap-1 rounded-full border border-gold-muted px-2 align-middle font-sans text-xs font-semibold text-gold-highlight">
                  <NotebookPen className="size-3.5" aria-hidden /> Note{notesByVerse.get(r.v)!.length > 1 ? `s (${notesByVerse.get(r.v)!.length})` : ""}
                </button>
              )}
            </p>
          ),
        )}
        {verses.length === 0 && <p className="text-muted-foreground">This chapter could not be loaded.</p>}
      </div>

      {selected.length > 0 && (
        <div
          role="toolbar"
          aria-label={`Actions for ${ref}`}
          className="fixed inset-x-2 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-xl rounded-2xl border border-gold-muted bg-card/95 p-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur md:bottom-6"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-gold-highlight">{ref}</p>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setSelected([])} aria-label="Clear selection">
              <X aria-hidden />
            </Button>
          </div>
          <div className="mb-2 flex items-center gap-2" role="group" aria-label="Highlight colour">
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={pending}
                onClick={() => highlight(c.id)}
                aria-label={`Highlight ${c.label.toLowerCase()}`}
                className={cn("size-9 rounded-full border-2 border-transparent focus-visible:border-white", c.swatch, selected.every((v) => highlights[v] === c.id) && "border-white")}
              />
            ))}
            {selected.some((v) => highlights[v]) && (
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => highlight(null)}>
                <Trash2 aria-hidden /> Remove
              </Button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-1">
            <ToolButton onClick={bookmark} disabled={pending} label={selected.length === 1 && bookmarks.has(selected[0]!) ? "Unmark" : "Bookmark"} icon={<Bookmark aria-hidden />} />
            <ToolButton onClick={openNote} disabled={pending} label="Note" icon={<NotebookPen aria-hidden />} />
            <ToolButton onClick={() => void copy()} label="Copy" icon={<Copy aria-hidden />} />
            <ToolButton onClick={() => void share()} label="Share" icon={<Share2 aria-hidden />} />
            <ToolButton onClick={memorize} disabled={pending} label="Memorize" icon={<Brain aria-hidden />} />
          </div>
        </div>
      )}

      <Dialog open={noteOpen !== null} onOpenChange={(o) => !o && setNoteOpen(null)}>
        <DialogContent side="bottom">
          {noteOpen && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const body = String(new FormData(e.currentTarget).get("body") ?? "");
                start(async () => {
                  const r = await saveBibleNoteAction({ id: noteOpen.id, bookId, chapter, verseStart: noteOpen.start, verseEnd: noteOpen.end, body });
                  if (!r.ok) return toast.error(r.error);
                  toast.success("Note saved. Only you can see it.");
                  setNoteOpen(null);
                  setSelected([]);
                  router.refresh();
                });
              }}
            >
              <DialogHeader>
                <DialogTitle>Note on {selectionReference(bookId, chapter, verseRange(noteOpen.start, noteOpen.end))}</DialogTitle>
                <DialogDescription>Private to you. Notes are never shared or given to the AI.</DialogDescription>
              </DialogHeader>
              <label htmlFor="bible-note" className="sr-only">
                Note
              </label>
              <textarea
                id="bible-note"
                name="body"
                defaultValue={noteOpen.body}
                required
                maxLength={10000}
                rows={6}
                autoFocus
                className="w-full rounded-xl border border-border bg-elevated p-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-highlight"
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setNoteOpen(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  Save note
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={viewNotes !== null} onOpenChange={(o) => !o && setViewNotes(null)}>
        <DialogContent side="bottom">
          <DialogHeader>
            <DialogTitle>Your notes</DialogTitle>
            <DialogDescription>Private to you.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-3">
            {(viewNotes ? (notesByVerse.get(viewNotes) ?? []) : []).map((n) => (
              <li key={n.id} className="rounded-xl bg-elevated p-3">
                <p className="text-xs font-semibold text-gold">{selectionReference(bookId, chapter, verseRange(n.verseStart, n.verseEnd))}</p>
                <p className="mt-1 whitespace-pre-wrap text-[0.9375rem]">{n.body}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setViewNotes(null);
                      setNoteOpen({ id: n.id, start: n.verseStart, end: n.verseEnd, body: n.body });
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await deleteBibleNoteAction(n.id);
                        if (!r.ok) return toast.error(r.error);
                        toast.success("Note deleted");
                        setViewNotes(null);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 aria-hidden /> Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolButton({ onClick, label, icon, disabled }: { onClick: () => void; label: string; icon: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold text-foreground hover:bg-elevated disabled:opacity-50 [&_svg]:size-5 [&_svg]:text-gold">
      {icon}
      {label}
    </button>
  );
}
