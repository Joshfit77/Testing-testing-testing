import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BackLink } from "@/components/platform/back-link";
import { PageHeader } from "@/components/common/page-header";
import { BibleSearchForm } from "@/components/bible/search-form";
import { bookById, chapterHref } from "@/lib/bible/books";
import { formatReference, parseReference } from "@/lib/bible/reference";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth";
import { getPassage, searchBible } from "@/server/bible/text";
import { ScriptureText } from "@/components/bible/scripture-text";
import { redLetterParts, type RedLetterSpan } from "@/lib/bible/red-letter";

export const metadata = { title: "Search the Bible" };

const PAGE = 50;
const PASSAGE_LIMIT = 40;

/** The verse's own words with the searched terms marked, and the words of Jesus in red. */
function Marked({ text, terms, jesus }: { text: string; terms: string[]; jesus?: readonly RedLetterSpan[] }) {
  const pattern = terms.length
    ? new RegExp(`\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]").replace(/ /g, "[\\s\\W]+")).join("|")})\\b`, "gi")
    : null;
  const mark = (chunk: string, key: string) =>
    pattern
      ? chunk.split(pattern).map((p, i) =>
          i % 2 === 1 ? (
            <mark key={`${key}.${i}`} className="rounded bg-gold/25 px-0.5 text-inherit">
              {p}
            </mark>
          ) : (
            <Fragment key={`${key}.${i}`}>{p}</Fragment>
          ),
        )
      : chunk;
  return (
    <>
      {redLetterParts(text, jesus).map((part, i) =>
        part.jesus ? (
          <span key={i} className="text-red-letter" data-words-of-jesus="">
            {mark(part.text, String(i))}
          </span>
        ) : (
          <Fragment key={i}>{mark(part.text, String(i))}</Fragment>
        ),
      )}
    </>
  );
}

export default async function BibleSearchPage({ searchParams }: { searchParams: Promise<{ q?: string; t?: string; p?: string }> }) {
  await requireOnboardedUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const testament = sp.t === "OT" || sp.t === "NT" ? sp.t : undefined;
  const page = Math.max(1, Math.min(200, Number(sp.p) || 1));

  const ref = q ? parseReference(q) : null;
  const namesChapter = /\d/.test(q);
  const passage = ref && namesChapter ? getPassage(ref) : [];
  const bookOnly = ref && !namesChapter ? bookById(ref.bookId) : undefined;
  const results = q && !passage.length ? searchBible(q, { testament, limit: PAGE, offset: (page - 1) * PAGE }) : null;
  const pages = results ? Math.ceil(results.total / PAGE) : 0;

  const href = (o: { t?: string; p?: number }) => {
    const u = new URLSearchParams({ q });
    if (o.t) u.set("t", o.t);
    if (o.p && o.p > 1) u.set("p", String(o.p));
    return `/faith/bible/search?${u}`;
  };

  return (
    <div className="space-y-4">
      <BackLink href="/faith/bible">Bible</BackLink>
      <PageHeader title="Search the Bible" description="Whole words in any order. Put words in quotes to find an exact phrase. Or type a reference like Romans 8:28." className="mb-2" />
      <BibleSearchForm defaultValue={q} testament={testament} autoFocus={!q} />

      {passage.length > 0 && ref && (
        <section className="rounded-2xl border border-gold-muted bg-card p-4" aria-label={formatReference(ref)}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold">{formatReference(ref)}</h2>
            <Link href={chapterHref(ref.bookId, ref.chapter, ref.verseStart)} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gold-highlight hover:underline">
              Open <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="space-y-1 font-serif text-[1.0625rem] leading-relaxed">
            {passage.slice(0, PASSAGE_LIMIT).map((v) => (
              <p key={`${v.chapter}:${v.verse}`}>
                <sup className="mr-1 font-sans text-xs font-semibold text-gold">{ref.chapterEnd ? `${v.chapter}:${v.verse}` : v.verse}</sup>
                <ScriptureText text={v.text} jesus={v.jesus} />
              </p>
            ))}
          </div>
          {passage.length > PASSAGE_LIMIT && <p className="mt-2 text-sm text-muted-foreground">Showing the first {PASSAGE_LIMIT} verses. Open the chapter to read on.</p>}
        </section>
      )}

      {bookOnly && (
        <Link href={`/faith/bible/${bookOnly.slug}`} className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-gold-muted bg-card px-4 hover:border-gold">
          <span>
            <span className="block text-xs text-muted-foreground">Book</span>
            <span className="block font-semibold">{bookOnly.name}</span>
          </span>
          <ArrowRight className="size-5 text-gold" aria-hidden />
        </Link>
      )}

      {results && (
        <section aria-labelledby="results-title" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="results-title" className="text-sm text-muted-foreground" aria-live="polite">
              {results.terms.length === 0
                ? "Type at least two letters."
                : results.total === 0
                  ? `No verses contain ${results.terms.map((t) => `“${t}”`).join(" and ")}.`
                  : `${results.total.toLocaleString("en-US")} verse${results.total === 1 ? "" : "s"}${pages > 1 ? ` · page ${page} of ${pages}` : ""}`}
            </h2>
            <nav aria-label="Filter by testament" className="flex gap-1">
              {[
                { t: undefined, label: "All" },
                { t: "OT", label: "Old" },
                { t: "NT", label: "New" },
              ].map((f) => (
                <Link
                  key={f.label}
                  href={href({ t: f.t })}
                  aria-current={testament === f.t ? "page" : undefined}
                  className={cn("inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-semibold", testament === f.t ? "border-gold bg-gold/10 text-gold-highlight" : "border-border text-muted-foreground")}
                >
                  {f.label}
                </Link>
              ))}
            </nav>
          </div>
          <ul className="space-y-2">
            {results.hits.map((h) => (
              <li key={h.reference}>
                <Link href={chapterHref(h.bookId, h.chapter, h.verse)} className="block rounded-2xl border border-border bg-card p-3 hover:border-gold-muted">
                  <span className="block text-xs font-semibold text-gold">{h.reference}</span>
                  <span className="mt-0.5 block font-serif text-[1.0625rem] leading-relaxed">
                    <Marked text={h.text} terms={results.terms} jesus={h.jesus} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between gap-2">
              {page > 1 ? (
                <Link href={href({ t: testament, p: page - 1 })} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">
                  Previous
                </Link>
              ) : (
                <span />
              )}
              {page < pages && (
                <Link href={href({ t: testament, p: page + 1 })} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">
                  Next
                </Link>
              )}
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
