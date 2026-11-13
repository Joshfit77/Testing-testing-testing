import Link from "next/link";
import { Bot, Brain, MessageSquarePlus, Gauge } from "lucide-react";
import { AiConsentCard } from "@/components/coach/ai-consent-card";
import { CoachChat, type ChatMessage } from "@/components/coach/coach-chat";
import { PageHeader } from "@/components/common/page-header";
import { allowanceRenewsOn } from "@/lib/domain/ai-allowance";
import { BackButton } from "@/components/common/back-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { getPlans } from "@/lib/domain/plans";
import { getNativePlatform } from "@/server/native";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { isAiConfigured, isServiceRoleConfigured } from "@/server/env";
import { COACH_FEEDBACK_FLAG, isFlagEnabled, isFlagOn } from "@/server/flags";
import { AiError, getAiUsage } from "@/server/services/ai-coach";
import { suggestedQuestions } from "@/lib/coach/context";
import { loadAthleteSnapshot } from "@/server/coach/snapshot";
import { demoAiSimulated } from "@/server/demo";
import { Notice } from "@/components/common/states";

export const metadata = { title: "AI Coach" };

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

/**
 * The coach for a member whose membership doesn't include it: what it does, what Pro costs, and a way to the plans,
 * instead of a chat they can't use. In the iPhone/Android app the store sets the price, so none is quoted here.
 */
function CoachProCard({ examples, priceLine }: { examples: string[]; priceLine: string }) {
  return (
    <section className="card-gold space-y-3 rounded-2xl p-5" aria-labelledby="coach-pro-title" data-testid="coach-upsell">
      <h2 id="coach-pro-title" className="flex items-center gap-2 font-display text-xl font-bold">
        <Bot className="size-5 text-gold" aria-hidden /> AI Coach is part of Pro
      </h2>
      <p className="text-sm text-foreground/90">
        Ask about your training, food and recovery. The coach reads your own logs to answer, and any change it suggests waits for you to confirm.
      </p>
      {examples.length > 0 && (
        <ul className="space-y-1 text-sm text-muted-foreground" aria-label="Questions you could ask">
          {examples.map((q) => (
            <li key={q}>&ldquo;{q}&rdquo;</li>
          ))}
        </ul>
      )}
      <p className="text-sm font-semibold text-gold-highlight" data-testid="coach-upsell-price">
        {priceLine}
      </p>
      <Button asChild className="w-full">
        <Link href="/profile/billing">See plans</Link>
      </Button>
    </section>
  );
}

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  const native = await getNativePlatform();
  const supabase = await getServerSupabase();
  const plan = await getUserPlan(user.id);
  const [convRes, exRes, flag, usageOrError] = await Promise.all([
    supabase
      .from("ai_conversations")
      .select("id, title, updated_at, memory_off")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase.from("exercises").select("slug, name"),
    isFlagEnabled("ai_coach"),
    // Not knowing the usage must read as "can't check right now", not as an error page.
    getAiUsage(user.id, plan).catch((e: unknown) => {
      if (e instanceof AiError) return e;
      throw e;
    }),
  ]);
  if (usageOrError instanceof AiError) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="AI Coach" title="AI Coach" />
        <p role="status" className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          {usageOrError.message}
        </p>
      </div>
    );
  }
  const usage = usageOrError;
  const plans = getPlans();
  const conversations = convRes.data ?? [];
  const { data: memoryProfile } = await supabase.from("profiles").select("coach_memory_enabled").eq("id", user.id).maybeSingle();
  const selected =
    sp.c && conversations.find((c) => c.id === sp.c) ? sp.c : null;
  const { data: msgs } = selected
    ? await supabase
        .from("ai_messages")
        .select("id, role, content, proposal, proposal_status, created_at")
        .eq("conversation_id", selected)
        .order("created_at")
    : { data: [] };

  // Pro, or a subscription that kept its AI allowance from before the plan change.
  const entitled = usage.chatLimit > 0;
  // Server-side gating is unchanged (src/server/services/ai-coach.ts); this only chooses what the page says.
  const unavailable = "The coach is unavailable right now. Everything else in the app works normally.";
  let disabledReason: string | null = null;
  if (!entitled) disabledReason = "AI coaching is included with Pro All Access.";
  else if (!isAiConfigured() || !flag || !isServiceRoleConfigured()) disabledReason = unavailable;
  else if (usage.chatUsed >= usage.chatLimit)
    disabledReason = `You've used all ${usage.chatLimit} AI requests for this month. They renew on ${allowanceRenewsOn(new Date())}; everything else in the app keeps working.`;

  // Pro members are asked once before the coach sends anything to the AI provider.
  const needsConsent =
    entitled && !disabledReason && !profile.ai_data_consent_at;

  // Starter questions from the user's own data, also when the coach can't be used right now (they show what it can do).
  let suggestions: string[] | undefined;
  if (!selected && !needsConsent) {
    try {
      suggestions = suggestedQuestions(
        await loadAthleteSnapshot(supabase, user.id)
      );
    } catch {
      suggestions = undefined;
    }
  }

  return (
    <div className="space-y-6">
      <BackButton />
      <PageHeader
        className="-mt-4"
        title="AI Coach"
        description="Personalized coaching from your goals, program, workouts, food log and bodyweight."
        actions={
          entitled ? (
            <>
              <Button asChild variant="secondary">
                <Link href="/coach/memory">
                  <Brain aria-hidden /> Memory
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/coach/usage">
                  <Gauge aria-hidden /> Usage
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/coach">
                  <MessageSquarePlus aria-hidden /> New chat
                </Link>
              </Button>
            </>
          ) : undefined
        }
      />
      {demoAiSimulated() && (
        <Notice tone="warning">
          <span data-testid="demo-ai-simulated">
            <strong>Demo:</strong> no AI model is connected. Replies here are written by a script and labelled as simulated. The app&apos;s real tools
            still run on the sample data, and suggested changes still wait for your approval.
          </span>
        </Notice>
      )}
      {conversations.length > 0 && (
        <details className="rounded-2xl border border-border bg-card p-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-semibold">
            History ({conversations.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {conversations.map((c) => (
              <li key={c.id as string}>
                <Link
                  href={`/coach?c=${c.id}`}
                  aria-current={c.id === selected ? "page" : undefined}
                  className={cn(
                    "block truncate rounded-xl px-3 py-2 text-sm",
                    c.id === selected
                      ? "bg-gold/10 text-gold-highlight"
                      : "text-muted-foreground hover:bg-elevated hover:text-foreground"
                  )}
                >
                  {c.title as string}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Conversations" className="hidden lg:block">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            History
          </p>
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No conversations yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((c) => (
                <li key={c.id as string}>
                  <Link
                    href={`/coach?c=${c.id}`}
                    aria-current={c.id === selected ? "page" : undefined}
                    className={cn(
                      "block truncate rounded-xl px-3 py-2 text-sm",
                      c.id === selected
                        ? "bg-gold/10 text-gold-highlight"
                        : "text-muted-foreground hover:bg-elevated hover:text-foreground"
                    )}
                  >
                    {c.title as string}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>
        {needsConsent ? (
          <AiConsentCard />
        ) : !entitled && !selected ? (
          <CoachProCard
            examples={(suggestions ?? []).slice(0, 3)}
            priceLine={
              native || !plans.pro.yearlyPriceCents
                ? `${plans.pro.name} · Faith stays free`
                : `Pro · ${money(plans.pro.priceCents)}/month or ${money(plans.pro.yearlyPriceCents)}/year · Faith stays free`
            }
          />
        ) : (
          <CoachChat
            conversationId={selected}
            initialMessages={(msgs ?? []) as ChatMessage[]}
            initialQuestion={selected ? "" : (sp.q ?? "").slice(0, 500)}
            enabled={!disabledReason}
            disabledReason={disabledReason}
            readOnly={!entitled}
            canGeneratePlans={usage.planLimit > 0}
            feedbackEnabled={entitled && (await isFlagOn(COACH_FEEDBACK_FLAG))}
            usage={{ used: usage.chatUsed, limit: usage.chatLimit }}
            advanced={{ used: usage.smartUsed, limit: usage.smartLimit }}
            suggestions={suggestions}
            memory={
              entitled
                ? {
                    enabled: Boolean(memoryProfile?.coach_memory_enabled),
                    chatOff: Boolean(conversations.find((c) => c.id === selected)?.memory_off),
                  }
                : null
            }
            exerciseNames={Object.fromEntries(
              (exRes.data ?? []).map((e) => [
                e.slug as string,
                e.name as string,
              ])
            )}
          />
        )}
      </div>
    </div>
  );
}
