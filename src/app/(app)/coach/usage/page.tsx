import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { Button } from "@/components/ui/button";
import { ALLOWANCE_RULES, allowanceRenewsOn } from "@/lib/domain/ai-allowance";
import { PLAN_RESERVE } from "@/lib/coach/routing";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { AiError, getAiUsage } from "@/server/services/ai-coach";
import { globalBudgetStatus } from "@/server/services/ai-budget";
import { logError } from "@/server/log";

export const metadata = { title: "AI usage" };

/**
 * The member's AI allowance this month: requests and advanced requests left, when they renew, and what counts. Read
 * from the same usage records the server enforces. No prices or margins are shown.
 */
export default async function AiUsagePage() {
  const { user } = await requireOnboardedUser();
  const plan = await getUserPlan(user.id);
  const now = new Date();
  const renews = allowanceRenewsOn(now);
  let usage: Awaited<ReturnType<typeof getAiUsage>> | null = null;
  let unavailable: string | null = null;
  try {
    usage = await getAiUsage(user.id, plan);
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    unavailable = err.message;
  }
  // When the whole app's AI budget is used up, say so plainly: it isn't the member's allowance.
  let paused = false;
  try {
    const g = await globalBudgetStatus(now);
    paused = g.budgetMicros <= 0 || g.spentMicros + g.reservedMicros >= g.budgetMicros;
  } catch (err) {
    logError("ai.usage_page_global", err);
  }

  const entitled = Boolean(usage && usage.chatLimit > 0);
  const left = usage ? Math.max(0, usage.chatLimit - usage.chatUsed) : 0;
  const advancedLeft = usage ? Math.max(0, usage.smartLimit - usage.smartUsed) : 0;
  const card = "rounded-2xl border border-border bg-card p-5";

  return (
    <div className="space-y-6" data-testid="ai-usage">
      <BackLink href="/coach">AI Coach</BackLink>
      <PageHeader eyebrow="AI Coach" title="AI usage" description="Your AI allowance this month. Nothing is ever charged beyond your membership." />

      {unavailable && <p className={`${card} text-sm`}>{unavailable}</p>}

      {!unavailable && !entitled && (
        <section className={`${card} space-y-3 text-sm`}>
          <p>AI features (the coach, AI programs and meal plans, food-photo analysis, AI explanations and the Bible study helper) are included with Pro All Access.</p>
          <p className="text-muted-foreground">Everything else in Narrow Gate Fitness works without AI and stays available on Free.</p>
          <Button asChild>
            <Link href="/profile/billing">See Pro All Access</Link>
          </Button>
        </section>
      )}

      {entitled && usage && (
        <>
          {paused && (
            <p role="status" className={`${card} text-sm`} data-testid="ai-paused">
              AI features are temporarily unavailable for everyone. This isn&apos;t your allowance: your requests below are unchanged, and everything else in the
              app keeps working.
            </p>
          )}
          <dl className="grid grid-cols-2 gap-3">
            <div className={card}>
              <dt className="text-xs text-muted-foreground">AI requests left</dt>
              <dd className="font-display text-3xl font-bold text-gold-highlight" data-testid="ai-requests-left">
                {left} <span className="text-base font-normal text-muted-foreground">of {usage.chatLimit}</span>
              </dd>
            </div>
            <div className={card}>
              <dt className="text-xs text-muted-foreground">Advanced requests left</dt>
              <dd className="font-display text-3xl font-bold text-gold-highlight" data-testid="ai-advanced-left">
                {advancedLeft} <span className="text-base font-normal text-muted-foreground">of {usage.smartLimit}</span>
              </dd>
            </div>
          </dl>
          <p className="text-sm text-muted-foreground" data-testid="ai-renews">
            Renews on {renews} (the 1st of every month, for monthly and yearly memberships alike).
          </p>
          {left === 0 && (
            <p role="status" className={`${card} text-sm`}>
              You&apos;ve used this month&apos;s AI requests. They renew on {renews}. Nothing extra is charged, and everything else in the app keeps working.
            </p>
          )}

          <section className={`${card} space-y-3 text-sm`} aria-labelledby="counts-title">
            <h2 id="counts-title" className="font-semibold">What uses a request</h2>
            <ul className="list-disc space-y-1 pl-5">
              {ALLOWANCE_RULES.requests.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <h2 className="pt-2 font-semibold">What uses an advanced request</h2>
            <p className="text-muted-foreground">Advanced requests come out of the same {usage.chatLimit}, and use the more capable model:</p>
            <ul className="list-disc space-y-1 pl-5">
              {ALLOWANCE_RULES.advanced.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="text-muted-foreground">
              The last {PLAN_RESERVE} advanced requests are kept for generating a program. When an answer that needed the advanced model runs on the standard one,
              the answer says so.
            </p>
            <h2 className="pt-2 font-semibold">Included without using a request</h2>
            <ul className="list-disc space-y-1 pl-5">
              {ALLOWANCE_RULES.free.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
