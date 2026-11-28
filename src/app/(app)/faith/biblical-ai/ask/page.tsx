import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { BackLink } from "@/components/platform/back-link";
import { AiConsentCard } from "@/components/coach/ai-consent-card";
import { BiblicalAiChat, type ChatMessage } from "@/components/biblical-ai/biblical-ai-chat";
import type { ValidatedAnswer } from "@/lib/biblical-ai/answer";
import { BIBLICAL_AI_DISCLAIMER, BIBLICAL_AI_NAME, PASSAGE_ACTIONS, categoryById, type CategoryId, type Depth } from "@/lib/biblical-ai/config";
import { formatReference, parseReference } from "@/lib/bible/reference";
import { readerHref } from "@/lib/biblical-ai/links";
import { getServerSupabase } from "@/lib/supabase/server";
import { passageText } from "@/server/bible/text";
import { loadBiblicalAiAccess } from "@/server/biblical-ai-access";
import { citedPassage } from "@/server/services/biblical-ai";

export const metadata = { title: "Ask · Narrow Gate Biblical AI" };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A Biblical AI conversation: a new one (optionally on a passage from the reader, a study area, a starting question,
 * or a journal entry the member chose to share), or an existing one (?c=…), which only its owner can open.
 */
export default async function AskPage({ searchParams }: { searchParams: Promise<{ c?: string; category?: string; q?: string; passage?: string; depth?: string; action?: string; share?: string }> }) {
  const sp = await searchParams;
  const access = await loadBiblicalAiAccess();
  const supabase = await getServerSupabase();

  let conversation: { id: string; title: string; category: CategoryId; passage: string | null } | null = null;
  let messages: ChatMessage[] = [];
  if (sp.c) {
    if (!uuid.test(sp.c)) notFound();
    // RLS: only the member's own conversation is readable.
    const { data } = await supabase.from("biblical_ai_conversations").select("id, title, category, passage").eq("id", sp.c).maybeSingle();
    if (!data) notFound();
    conversation = { id: data.id as string, title: data.title as string, category: data.category as CategoryId, passage: (data.passage as string | null) ?? null };
    const { data: rows } = await supabase.from("biblical_ai_messages").select("id, role, content, answer").eq("conversation_id", sp.c).order("created_at").limit(60);
    messages = (rows ?? []).map((r) => {
      const answer = (r.answer as ValidatedAnswer | null) ?? null;
      return {
        id: r.id as string,
        role: r.role as "user" | "assistant",
        content: r.content as string,
        answer,
        passages: answer ? answer.scripture.map((s) => citedPassage(s.reference)).filter((p): p is NonNullable<typeof p> => Boolean(p)) : [],
      };
    });
  }

  const category = conversation?.category ?? categoryById(sp.category)?.id ?? "scripture";
  const passageRef = sp.passage ? parseReference(sp.passage) : null;
  const passage = conversation?.passage ?? (passageRef && passageText(passageRef) ? formatReference(passageRef) : null);
  const action = PASSAGE_ACTIONS.find((a) => a.id === sp.action);
  const initialQuestion = (action && passage ? action.prompt.replace("{ref}", passage) : sp.q)?.slice(0, 600);
  const depth = (action?.depth ?? (["quick", "standard", "deep"].includes(sp.depth ?? "") ? sp.depth : "standard")) as Depth;

  // A journal entry the member chose to share ("share=journal:<id>"): read through RLS, shown before anything is sent.
  let shared: { label: string; text: string } | null = null;
  const journalId = sp.share?.startsWith("journal:") ? sp.share.slice(8) : null;
  if (journalId && uuid.test(journalId)) {
    const { data: entry } = await supabase.from("faith_journal_entries").select("title, body, entry_date").eq("id", journalId).maybeSingle();
    if (entry) shared = { label: (entry.title as string | null) || `Journal entry, ${entry.entry_date as string}`, text: String(entry.body).slice(0, 2000) };
  }

  const passageHref = passageRef ? readerHref(passageRef, null) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/faith/biblical-ai">Biblical AI</BackLink>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">{BIBLICAL_AI_NAME}</p>
        <h1 className="font-display text-2xl font-bold leading-tight">{conversation?.title ?? categoryById(category)?.title ?? "Ask"}</h1>
        {passage && (
          <p className="mt-1 text-sm text-muted-foreground">
            Studying{" "}
            {passageHref ? (
              <Link href={passageHref} className="inline-flex items-center gap-1 font-semibold text-gold-highlight hover:underline">
                <BookOpen className="size-3.5" aria-hidden /> {passage}
              </Link>
            ) : (
              passage
            )}
          </p>
        )}
      </header>
      <p className="text-xs text-muted-foreground">{BIBLICAL_AI_DISCLAIMER}</p>
      {!access.canAsk ? (
        <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm" data-testid="biblical-ai-unavailable">
          Biblical AI is temporarily unavailable. The Bible is free to read and search.
        </p>
      ) : !access.consented ? (
        <div className="space-y-3" data-testid="biblical-ai-consent">
          <p className="rounded-xl border border-border bg-card p-4 text-sm">Allow AI data sharing to ask a question. Biblical AI sends your question and the passages it looks up to our AI provider.</p>
          <AiConsentCard />
        </div>
      ) : (
        <BiblicalAiChat
          key={conversation?.id ?? "new"}
          conversationId={conversation?.id ?? null}
          initialMessages={messages}
          category={category}
          depth={depth}
          allowedDepths={access.limits.depths}
          initialQuestion={initialQuestion}
          passage={passage}
          shared={shared}
          remainingToday={access.remainingToday}
        />
      )}
    </div>
  );
}
