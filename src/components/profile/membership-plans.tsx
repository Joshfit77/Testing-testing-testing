"use client";

import type { ReactNode } from "react";
import { Check, ChartLine, Dumbbell, Hammer, Minus, Moon, Route, Salad, ScanLine, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ComparisonSection } from "@/lib/domain/membership";
import type { Plan } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export type BillingInterval = "month" | "year";

/** The prices to show. On the website they come from Stripe; in the app from the App Store or Google Play. */
export interface MembershipPrices {
  /** e.g. "$19.99", or null while loading / not offered. */
  month: string | null;
  /** e.g. "$149.99", or null when yearly isn't offered here. */
  year: string | null;
  /** e.g. "$12.49" for the yearly price spread over 12 months, when known. */
  yearPerMonth: string | null;
  /** Whole-percent saving of yearly over 12 monthly payments, when known. */
  savingsPercent: number | null;
}

const PRO_HIGHLIGHTS = [
  { icon: Sparkles, text: "AI personal coaching" },
  { icon: Dumbbell, text: "Complete workout library" },
  { icon: Hammer, text: "Custom programs" },
  { icon: Route, text: "Live GPS tracking" },
  { icon: Salad, text: "Advanced nutrition & meal planning" },
  { icon: Moon, text: "Sleep & recovery insights" },
  { icon: ScanLine, text: "Body Scan" },
  { icon: ChartLine, text: "Progress analytics" },
];

const FREE_HIGHLIGHTS = [
  "Workout logging & starter programs",
  "All 157 exercise demonstrations",
  "Calorie & macro tracking with barcode scanning",
  "Manual run & walk logging",
  "Sleep logging, weight & badges",
  "The complete Faith & Discipline section",
];

/**
 * The two memberships new customers can choose: Free and Pro All Access, monthly or yearly. Presentational only:
 * the caller supplies the prices of the channel the member is buying through and the buttons that act on it, so
 * the website (Stripe) and the iPhone/Android app (App Store/Google Play) show the same plans and wording.
 */
export function MembershipPlans({
  currentPlan,
  interval,
  onIntervalChange,
  prices,
  comparison,
  proAction,
  freeAction,
  footer,
}: {
  currentPlan: Plan;
  interval: BillingInterval;
  onIntervalChange: (interval: BillingInterval) => void;
  prices: MembershipPrices;
  comparison: ComparisonSection[];
  proAction: ReactNode;
  freeAction?: ReactNode;
  footer?: ReactNode;
}) {
  const yearOffered = prices.year !== null;
  const shown = interval === "year" && yearOffered ? "year" : "month";
  const price = shown === "year" ? prices.year : prices.month;
  const onPro = currentPlan === "pro";

  return (
    <section className="space-y-6" aria-labelledby="membership-title">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Membership</p>
        <h2 id="membership-title" className="mt-2 font-display text-3xl font-bold uppercase tracking-wide md:text-4xl">
          Choose your path
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Start free. Upgrade when you&apos;re ready for every premium feature.</p>
      </div>

      {yearOffered && (
        <div className="flex justify-center">
          <div role="radiogroup" aria-label="Billing period" className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {(["month", "year"] as const).map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={shown === i}
                data-testid={`interval-${i}`}
                onClick={() => onIntervalChange(i)}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-highlight",
                  shown === i ? "bg-gold-gradient text-black" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {i === "month" ? "Monthly" : "Yearly"}
                {i === "year" && prices.savingsPercent ? (
                  <span className={cn("rounded-full px-2 py-0.5 text-[0.7rem] font-bold", shown === i ? "bg-black/15" : "bg-gold/15 text-gold-highlight")}>Save {prices.savingsPercent}%</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <article
          aria-labelledby="plan-free-title"
          className={cn("flex flex-col rounded-2xl border bg-card p-6", currentPlan === "free" ? "border-gold-muted" : "border-border")}
          data-testid="plan-free"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 id="plan-free-title" className="font-display text-xl font-semibold uppercase tracking-wider">
              Free
            </h3>
            {currentPlan === "free" && <Badge>Your plan</Badge>}
          </div>
          <p className="mt-3 text-4xl font-bold">$0</p>
          <p className="mt-1 text-sm text-muted-foreground">Build your foundation.</p>
          <ul className="mt-5 space-y-2 text-sm">
            {FREE_HIGHLIGHTS.map((h) => (
              <li key={h} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden /> {h}
              </li>
            ))}
          </ul>
          {freeAction ? <div className="mt-auto pt-5">{freeAction}</div> : null}
        </article>

        <article
          aria-labelledby="plan-pro-title"
          className="relative flex flex-col overflow-hidden rounded-2xl border border-gold-muted bg-card-gradient p-6 shadow-[0_24px_70px_-34px_rgba(201,165,76,0.75)]"
          data-testid="plan-pro"
        >
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-highlight to-transparent" />
          <div className="flex items-center justify-between gap-2">
            <h3 id="plan-pro-title" className="font-display text-xl font-semibold uppercase tracking-wider text-gold-highlight">
              Pro All Access
            </h3>
            {onPro ? <Badge>Your plan</Badge> : <Badge variant="outline">Most complete</Badge>}
          </div>
          <p className="mt-3 text-4xl font-bold" data-testid="pro-price">
            {price ?? "—"}
            {price && <span className="text-base font-normal text-muted-foreground"> / {shown === "year" ? "year" : "month"}</span>}
          </p>
          <p className="mt-1 min-h-5 text-sm text-muted-foreground">
            {shown === "year" && prices.yearPerMonth ? `About ${prices.yearPerMonth} a month, billed yearly.` : shown === "month" && prices.year ? `Or ${prices.year} a year.` : ""}
          </p>
          <p className="mt-2 font-display text-sm font-semibold uppercase tracking-[0.18em] text-gold">One membership. Every premium feature.</p>
          <ul className="mt-5 grid gap-x-4 gap-y-2.5 text-sm sm:grid-cols-2">
            {PRO_HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2">
                <Icon className="size-4 shrink-0 text-gold" aria-hidden /> {text}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Monthly and yearly unlock exactly the same features.</p>
          <div className="mt-auto pt-5">{proAction}</div>
        </article>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[22rem] text-sm">
          <caption className="sr-only">What Free and Pro All Access include</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-4 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Compare
              </th>
              <th scope="col" className="w-24 p-4 text-center font-display text-xs font-semibold uppercase tracking-widest">
                Free
              </th>
              <th scope="col" className="w-32 p-4 text-center font-display text-xs font-semibold uppercase tracking-widest text-gold-highlight">
                Pro
              </th>
            </tr>
          </thead>
          {comparison.map((section) => (
            <tbody key={section.title}>
              <tr>
                <th scope="colgroup" colSpan={3} className="bg-elevated/60 px-4 py-2 text-left text-xs font-semibold uppercase tracking-widest text-gold">
                  {section.title}
                </th>
              </tr>
              {section.rows.map((row) => (
                <tr key={row.label} className="border-t border-border/60">
                  <th scope="row" className="p-4 text-left font-normal">
                    {row.label}
                  </th>
                  <td className="p-4 text-center">
                    <Cell value={row.free} />
                  </td>
                  <td className="p-4 text-center">
                    <Cell value={row.pro} pro />
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {footer}
    </section>
  );
}

function Cell({ value, pro }: { value: boolean | string; pro?: boolean }) {
  if (value === true) return <Check className={cn("mx-auto size-5", pro ? "text-gold-highlight" : "text-gold")} aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/60" aria-label="Not included" />;
  return <span className={cn("text-xs font-semibold", pro ? "text-gold-highlight" : "text-foreground")}>{value}</span>;
}
