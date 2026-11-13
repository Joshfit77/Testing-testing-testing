"use client";

import type { ReactNode } from "react";
import { Check, ChartLine, ChevronDown, Dumbbell, Hammer, Minus, Moon, Route, Salad, ScanLine, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ComparisonSection } from "@/lib/domain/membership";
import type { Plan } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export type BillingInterval = "month" | "year";

/** The prices to show. On the website they come from Stripe; in the app from the App Store or Google Play. */
export interface MembershipPrices {
  /** e.g. "$17.99", or null while loading / not offered. */
  month: string | null;
  /** e.g. "$119.99", or null when yearly isn't offered here. */
  year: string | null;
  /** e.g. "$10.00" for the yearly price spread over 12 months, when known (an equivalent, never a monthly charge). */
  yearPerMonth: string | null;
  /** Whole-percent saving of yearly over 12 monthly payments, when known. */
  savingsPercent: number | null;
  /** The same saving in money, e.g. "$95.89", when known. */
  yearSaving?: string | null;
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
  "Workout logging, a personal starter plan & 5 saved workouts",
  "200+ exercises with demonstrations",
  "Calorie & macro tracking with barcode scanning",
  "Manual run & walk logging",
  "Sleep logging, weight & badges",
  "The complete Faith & Discipline section, always free",
];

/**
 * The two memberships new customers can choose: Free and Pro All Access, monthly or yearly. Both prices come first
 * (the billing period choice), then the two plans, with the full comparison folded under "Compare Free and Pro" so
 * the features aren't listed three times on the first screens. Presentational only:
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
    <section className="space-y-4" aria-labelledby="membership-title">
      <h2 id="membership-title" className="font-display text-sm font-semibold text-gold-highlight">
        Narrow Gate Fitness Pro
      </h2>

      {yearOffered && (
        <div role="radiogroup" aria-label="Billing period" className="grid grid-cols-2 gap-3">
          {(["month", "year"] as const).map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={shown === i}
              data-testid={`interval-${i}`}
              onClick={() => onIntervalChange(i)}
              className={cn(
                "relative flex min-h-[6.5rem] flex-col items-start justify-end rounded-2xl p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-highlight",
                shown === i ? "card-gold-strong" : i === "year" ? "border border-gold-muted bg-card hover:border-gold" : "border border-border bg-card hover:border-gold-muted",
              )}
            >
              {i === "year" && prices.savingsPercent ? (
                <span className="absolute right-3 top-3 rounded-full bg-gold-gradient px-2 py-0.5 text-xs font-bold text-black" data-testid="year-saving-badge">
                  Save {prices.savingsPercent}%
                </span>
              ) : null}
              <span className="text-sm font-semibold text-muted-foreground">{i === "month" ? "Monthly" : "Annual"}</span>
              <span className="mt-1 font-display text-2xl font-bold tabular-nums">{i === "month" ? (prices.month ?? "—") : (prices.year ?? "—")}</span>
              <span className="text-xs text-muted-foreground">{i === "month" ? "per month, billed monthly" : "per year, billed once a year"}</span>
              {i === "year" && prices.yearSaving ? (
                <span className="text-xs font-semibold text-gold-highlight" data-testid="year-saving">
                  {prices.yearSaving} less than 12 monthly payments
                </span>
              ) : null}
            </button>
          ))}
          {prices.savingsPercent ? (
            <p className="col-span-2 text-center text-sm font-semibold text-gold" data-testid="annual-savings-line">
              Save {prices.savingsPercent}% with annual billing
            </p>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <article
          aria-labelledby="plan-free-title"
          className={cn("order-2 flex flex-col rounded-2xl border bg-card p-6", currentPlan === "free" ? "border-gold-muted" : "border-border")}
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
          className="card-gold relative order-1 flex flex-col overflow-hidden rounded-2xl p-6"
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
            {billingLine(shown, prices)}
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

      <details className="group rounded-2xl border border-border bg-card" data-testid="plan-comparison">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden">
          Compare Free and Pro
          <ChevronDown className="size-5 text-gold transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
        </summary>
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full min-w-[17rem] text-sm">
            <caption className="sr-only">What Free and Pro All Access include</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-4 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Compare
                </th>
                <th scope="col" className="w-16 p-3 text-center font-display text-xs font-semibold uppercase tracking-widest">
                  Free
                </th>
                <th scope="col" className="w-20 p-3 text-center font-display text-xs font-semibold uppercase tracking-widest text-gold-highlight">
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
                    <td className="p-3 text-center">
                      <Cell value={row.free} />
                    </td>
                    <td className="p-3 text-center">
                      <Cell value={row.pro} pro />
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </details>

      {footer}
    </section>
  );
}

/**
 * What the member will be charged, and how often, in words. A yearly membership is one charge a year: the
 * per-month figure is shown only as an equivalent, never as a monthly charge.
 */
export function billingLine(shown: BillingInterval, prices: MembershipPrices): string {
  if (shown === "year" && prices.year) {
    const save = prices.savingsPercent ? ` Save approximately ${prices.savingsPercent}% compared with monthly billing.` : "";
    const equiv = prices.yearPerMonth ? ` (about ${prices.yearPerMonth} a month)` : "";
    return `Billed ${prices.year} once a year${equiv}.${save}`;
  }
  if (shown === "month" && prices.month) return `Billed ${prices.month} every month.${prices.year ? ` Or ${prices.year} a year.` : ""}`;
  return "";
}

function Cell({ value, pro }: { value: boolean | string; pro?: boolean }) {
  if (value === true) return <Check className={cn("mx-auto size-5", pro ? "text-gold-highlight" : "text-gold")} aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/60" aria-label="Not included" />;
  return <span className={cn("text-xs font-semibold", pro ? "text-gold-highlight" : "text-foreground")}>{value}</span>;
}
