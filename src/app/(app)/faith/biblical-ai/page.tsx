import Link from "next/link";
import { BookMarked, BookOpen, Cross, GraduationCap, History, Info, Landmark, Languages, MessageSquareText, Plus, Shield, Sparkles, UserRound } from "lucide-react";
import { BackLink } from "@/components/platform/back-link";
import { AiConsentCard } from "@/components/coach/ai-consent-card";
import { ConversationList } from "@/components/biblical-ai/conversation-list";
import { BIBLICAL_AI_DISCLAIMER, BIBLICAL_AI_NAME, BIBLICAL_AI_SUBTITLE, BIBLICAL_AI_TAGLINE, CATEGORIES, type CategoryId } from "@/lib/biblical-ai/config";
import { askHref } from "@/lib/biblical-ai/links";
import { getServerSupabase } from "@/lib/supabase/server";
import { loadBiblicalAiAccess } from "@/server/biblical-ai-access";

export const metadata = { title: "Narrow Gate Biblical AI" };

const ICONS: Record<CategoryId, typeof BookOpen> = { scripture: BookOpen, doctrine: Cross, apologetics: Shield, languages: Languages, history: Landmark, personal: UserRound };

/** The Biblical AI dashboard: six study areas (folded), the member's recent studies, saved studies and limits. */
export default async function BiblicalAiPage() {
  const access = await loadBiblicalAiAccess();
  const supabase = await getServerSupabase();
  const { data: convos } = await supabase
    .from("biblical_ai_conversations")
    .select("id, title, category, passage, updated_at")
    .eq("user_id", access.user.id)
    .order("updated_at", { ascending: false })
    .limit(Math.min(access.limits.historyListed, 20));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/faith">Faith</BackLink>
      <header className="relative overflow-hidden rounded-2xl border border-gold-muted bg-[radial-gradient(120%_120%_at_100%_0%,rgba(212,175,55,0.18),transparent_60%)] bg-card p-5" data-testid="biblical-ai-header">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          <Sparkles className="size-3.5" aria-hidden /> Faith
        </p>
        <h1 className="mt-1 font-display text-[1.75rem] font-bold leading-tight">{BIBLICAL_AI_NAME}</h1>
        <p className="font-serif text-lg italic text-champagne">{BIBLICAL_AI_SUBTITLE}</p>
        <p className="mt-1 text-sm text-muted-foreground">{BIBLICAL_AI_TAGLINE}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/faith/biblical-ai/ask" className="inline-flex h-11 items-center gap-2 rounded-full bg-gold-gradient px-5 text-sm font-semibold text-black shadow-bronze hover:brightness-110" data-testid="biblical-ai-ask-cta">
            <MessageSquareText className="size-4" aria-hidden /> Ask a Biblical Question
          </Link>
          {convos?.[0] && (
            <Link href={askHref({ conversation: convos[0].id as string })} className="inline-flex h-11 items-center gap-2 rounded-full border border-gold-muted px-4 text-sm font-semibold text-gold-highlight hover:bg-gold/10">
              <History className="size-4" aria-hidden /> Continue previous study
            </Link>
          )}
        </div>
      </header>

      <p className="flex items-start gap-2 rounded-xl border border-border bg-elevated/50 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
        <span>
          {BIBLICAL_AI_DISCLAIMER} Your questions are sent to our AI provider to be answered; your prayer journal and notes are never sent unless you choose to share a specific entry.
        </span>
      </p>

      {!access.canAsk ? (
        <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm" data-testid="biblical-ai-unavailable">
          Biblical AI is temporarily unavailable. The Bible, word studies and your saved studies are still here.
        </p>
      ) : !access.consented ? (
        <div className="space-y-3" data-testid="biblical-ai-consent">
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            <span className="font-semibold">Allow AI data sharing to ask a question.</span> Biblical AI sends your question and the Bible passages it looks up to our AI provider, so it waits for your permission. It is the same setting the AI Coach uses; you can turn it off any time in Profile &amp; Settings → Privacy &amp; data.
          </p>
          <AiConsentCard />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="biblical-ai-limits">
          {access.remainingToday} question{access.remainingToday === 1 ? "" : "s"} left today
          {access.limits.tier === "free" ? " on the Free plan. Deep studies, original-language analysis and personalized studies are included with Pro All Access." : "."}
        </p>
      )}

      <section aria-labelledby="areas-title" className="space-y-2">
        <h2 id="areas-title" className="text-lg font-semibold">
          Study areas
        </h2>
        {CATEGORIES.map((c) => {
          const Icon = ICONS[c.id];
          return (
            <details key={c.id} className="group rounded-2xl border border-border bg-card" data-testid={`category-${c.id}`}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 [&::-webkit-details-marker]:hidden">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold-muted bg-gold/10">
                  <Icon className="size-4 text-gold" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{c.title}</span>
                  <span className="block text-sm text-muted-foreground">{c.description}</span>
                </span>
                <span aria-hidden className="text-gold transition-transform group-open:rotate-90">›</span>
              </summary>
              <ul className="grid gap-1 px-4 pb-4 sm:grid-cols-2">
                {c.topics.map((t) => (
                  <li key={t.label}>
                    <Link
                      href={t.label === "Personalized Bible study" ? "/faith/biblical-ai/studies/new" : askHref({ category: c.id, q: t.prompt || undefined, depth: c.id === "languages" ? "deep" : undefined })}
                      className="flex min-h-11 items-center rounded-lg border border-border px-3 text-sm hover:border-gold-muted"
                    >
                      {t.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </section>

      <nav aria-label="Your studies" className="grid grid-cols-2 gap-2">
        <Link href="/faith/biblical-ai/saved" className="flex min-h-14 items-center gap-2 rounded-2xl border border-border bg-card px-4 text-sm font-semibold hover:border-gold-muted">
          <BookMarked className="size-5 text-gold" aria-hidden /> Saved studies
        </Link>
        <Link href="/faith/biblical-ai/studies/new" className="flex min-h-14 items-center gap-2 rounded-2xl border border-border bg-card px-4 text-sm font-semibold hover:border-gold-muted">
          <GraduationCap className="size-5 text-gold" aria-hidden /> New personalized study
        </Link>
      </nav>

      <section aria-labelledby="recent-title" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 id="recent-title" className="text-lg font-semibold">
            Recent studies
          </h2>
          <Link href="/faith/biblical-ai/ask" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gold-highlight">
            <Plus className="size-4" aria-hidden /> New
          </Link>
        </div>
        <ConversationList conversations={(convos ?? []).map((c) => ({ id: c.id as string, title: c.title as string, category: c.category as CategoryId, passage: (c.passage as string | null) ?? null, updatedAt: c.updated_at as string }))} />
      </section>
    </div>
  );
}
