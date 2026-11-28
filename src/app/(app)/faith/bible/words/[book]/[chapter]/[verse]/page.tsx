import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, MessageSquareText } from "lucide-react";
import { BackLink } from "@/components/platform/back-link";
import { ScriptureText } from "@/components/bible/scripture-text";
import { bookById, bookBySlug, chapterHref } from "@/lib/bible/books";
import { formatReference } from "@/lib/bible/reference";
import { ORIGINAL_LANGUAGE_LABEL, isRightToLeft, parseCompactReference } from "@/lib/bible/original-languages";
import { askHref, readerHref, safeBack } from "@/lib/biblical-ai/links";
import { getChapter, lastVerse, passageParts, passageText } from "@/server/bible/text";
import { occurrences, originalLanguageMeta, originalVerse } from "@/server/bible/original-languages";
import { loadBiblicalAiAccess } from "@/server/biblical-ai-access";

export const metadata = { title: "Original words · Narrow Gate Biblical AI" };

/**
 * Every word of one verse in Hebrew, Aramaic or Greek: the word as written, transliteration, gloss, Strong's number,
 * parsing and lexicon entry, with where else the word occurs. From STEPBible data (CC BY 4.0); no AI is involved.
 */
export default async function WordsPage({ params, searchParams }: { params: Promise<{ book: string; chapter: string; verse: string }>; searchParams: Promise<{ back?: string }> }) {
  const [{ book: slug, chapter: ch, verse: vs }, sp] = await Promise.all([params, searchParams]);
  await loadBiblicalAiAccess();
  const book = bookBySlug(slug);
  const chapter = Number(ch);
  const verse = Number(vs);
  if (!book || !Number.isInteger(chapter) || !Number.isInteger(verse) || !getChapter(book.id, chapter) || verse < 1 || verse > lastVerse(book.id, chapter)) notFound();
  const ref = { bookId: book.id, chapter, verseStart: verse };
  const ov = originalVerse(book.id, chapter, verse);
  const english = passageText(ref);
  const reference = formatReference(ref);
  const back = safeBack(sp.back) ?? null;
  const here = `/faith/bible/words/${book.slug}/${chapter}`;
  const rtl = ov ? isRightToLeft(ov.language) : false;
  const lang = ov?.language === "greek" ? "grc" : ov?.language === "aramaic" ? "arc" : "he";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href={back ?? chapterHref(book, chapter, verse)}>{back ? "Back to your study" : reference}</BackLink>
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Original words{ov ? ` · ${ORIGINAL_LANGUAGE_LABEL[ov.language]}` : ""}</p>
        <h1 className="font-display text-2xl font-bold">{reference}</h1>
        {english && (
          <p className="font-serif text-base text-foreground/90">
            <ScriptureText text={english} parts={passageParts(ref)} /> <span className="font-sans text-xs text-muted-foreground">(BSB)</span>
          </p>
        )}
      </header>
      <nav aria-label="Verse navigation" className="flex items-center justify-between">
        {verse > 1 ? (
          <Link href={`${here}/${verse - 1}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gold-highlight">
            <ChevronLeft className="size-4" aria-hidden /> Verse {verse - 1}
          </Link>
        ) : (
          <span />
        )}
        <Link href={readerHref(ref, back)} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gold-highlight">
          <BookOpen className="size-4" aria-hidden /> Read the chapter
        </Link>
        {verse < lastVerse(book.id, chapter) ? (
          <Link href={`${here}/${verse + 1}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gold-highlight">
            Verse {verse + 1} <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span />
        )}
      </nav>

      {!ov ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm">This verse has no text in the Berean Standard Bible (it is found only in later manuscripts), so there are no original words to show.</p>
      ) : (
        <>
          {ov.disputed && <p className="rounded-xl border border-gold-muted/60 bg-gold/5 p-3 text-sm" data-testid="words-disputed">{ov.disputed}</p>}
          {ov.hebrewReference && <p className="text-xs text-muted-foreground">In the Hebrew Bible this is {book.name} {ov.hebrewReference.replace(".", ":")}.</p>}
          <p lang={lang} dir={rtl ? "rtl" : "ltr"} className="rounded-xl border border-border bg-card p-3 font-serif text-2xl leading-loose" data-testid="words-original">
            {ov.words.map((w) => w.surface.replace(/\//g, "")).join(" ")}
          </p>
          <ol className="space-y-2" data-testid="words-list">
            {ov.words.map((w, i) => {
              const occ = occurrences(w.strong);
              // Per word: Daniel and Ezra move between Hebrew and Aramaic within a verse.
              const wordLang = w.language === "greek" ? "grc" : w.language === "aramaic" ? "arc" : "he";
              return (
                <li key={i}>
                  <details className="group rounded-2xl border border-border bg-card">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
                      <span lang={wordLang} dir={rtl ? "rtl" : "ltr"} className="min-w-[5rem] font-serif text-xl">
                        {w.surface.replace(/\//g, "")}
                      </span>
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block font-semibold">{w.gloss.replace(/\//g, " ")}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {w.transliteration} · {w.strong}
                          {w.language === "aramaic" && ov.language !== "aramaic" ? " · Aramaic" : ""}
                        </span>
                      </span>
                    </summary>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-4 pb-4 text-sm">
                      <dt className="text-muted-foreground">Dictionary form</dt>
                      <dd lang={wordLang} dir={rtl ? "rtl" : "ltr"} className="text-left font-serif">{w.lemma || "—"}</dd>
                      <dt className="text-muted-foreground">Parsing</dt>
                      <dd>{w.parsing || w.morphology}</dd>
                      <dt className="text-muted-foreground">Strong&apos;s</dt>
                      <dd>{w.strongs.replace(/[{}]/g, "")}</dd>
                      {w.lexicon && (
                        <>
                          <dt className="text-muted-foreground">Meaning</dt>
                          <dd>{w.lexicon.gloss}</dd>
                          <dt className="sr-only">Lexicon</dt>
                          <dd className="col-span-2 text-xs leading-relaxed text-muted-foreground">{w.lexicon.definition}</dd>
                        </>
                      )}
                      {occ.total > 0 && (
                        <>
                          <dt className="text-muted-foreground">Occurs in</dt>
                          <dd>
                            {occ.total} verse{occ.total === 1 ? "" : "s"}, including{" "}
                            {occ.verses
                              .filter((v) => v !== `${book.id} ${chapter}:${verse}`)
                              .slice(0, 6)
                              .map((v, j) => {
                                const r = parseCompactReference(v);
                                return r ? (
                                  <span key={v}>
                                    {j > 0 && ", "}
                                    <Link href={`/faith/bible/words/${bookById(r.bookId)?.slug ?? slug}/${r.chapter}/${r.verseStart}${back ? `?back=${encodeURIComponent(back)}` : ""}`} className="text-gold-highlight hover:underline">
                                      {formatReference(r)}
                                    </Link>
                                  </span>
                                ) : null;
                              })}
                          </dd>
                        </>
                      )}
                    </dl>
                  </details>
                </li>
              );
            })}
          </ol>
          {ov.variants.length > 0 && (
            <details className="rounded-2xl border border-border bg-card" data-testid="words-variants">
              <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">Words found in other editions ({ov.variants.length})</summary>
              <ul className="space-y-1 px-4 pb-4 text-sm">
                {ov.variants.map((v, i) => (
                  <li key={i}>
                    <span lang="grc" className="font-serif">{v.surface}</span> <span className="text-xs text-muted-foreground">{v.editions}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <Link href={askHref({ category: "languages", depth: "deep", passage: reference, q: `What do the key original-language words in ${reference} mean in context?` })} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold-muted px-4 text-sm font-semibold text-gold-highlight hover:bg-gold/10">
            <MessageSquareText className="size-4" aria-hidden /> Ask Biblical AI about these words
          </Link>
          <p className="text-xs text-muted-foreground">{originalLanguageMeta().attribution} Glosses are word-for-word aids; read the verse in its context.</p>
        </>
      )}
    </div>
  );
}
