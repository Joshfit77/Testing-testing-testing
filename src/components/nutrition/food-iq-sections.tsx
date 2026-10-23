import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleHelp, FlaskConical, Info, ShieldAlert, ShieldCheck, Target } from "lucide-react";
import { EVIDENCE_HELP, EVIDENCE_LABEL, type EvidenceClass, type IngredientAlert } from "@/lib/additive-evidence";
import { CLASS_KIND_LABEL, KIND_LABEL, SCORE_MEANING, type Band, type FoodIqScore, type GoalFit, type NutrientClass } from "@/lib/food-iq";
import type { QualityProduct } from "@/lib/food-quality";
import { cn } from "@/lib/utils";

const BAND_STYLE: Record<Band, string> = {
  excellent: "text-[#5fc49a] border-[#5fc49a]/60",
  good: "text-[#9fd68a] border-[#9fd68a]/60",
  moderate: "text-gold border-gold/60",
  poor: "text-[#e9a066] border-[#e9a066]/60",
  very_poor: "text-[#f08a8a] border-[#f08a8a]/60",
};
const BAND_STROKE: Record<Band, string> = { excellent: "#5fc49a", good: "#9fd68a", moderate: "#c9a54c", poor: "#e9a066", very_poor: "#f08a8a" };

export function ScoreRing({ score, band, size = 112 }: { score: number; band: Band; size?: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Food IQ ${score} out of 100`} className="shrink-0">
      <defs>
        <linearGradient id="fiq-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f1dfa8" />
          <stop offset="1" stopColor={BAND_STROKE[band]} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r={r} fill="#0e0e0e" stroke="#2b2824" strokeWidth="8" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="url(#fiq-ring)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 50 50)" />
      <text x="50" y="52" textAnchor="middle" fontSize="28" fontWeight="800" fill="#ffffff" fontFamily="var(--font-display, system-ui)">
        {score}
      </text>
      <text x="50" y="68" textAnchor="middle" fontSize="10" fill="#b3b0aa">
        / 100
      </text>
    </svg>
  );
}

export function SmallScore({ score }: { score: FoodIqScore }) {
  if (score.status !== "scored") return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-bold tabular-nums", BAND_STYLE[score.band.id])} title={`Food IQ ${score.score}/100 · ${score.band.label} (experimental)`}>
      {score.score}
      <span className="sr-only"> out of 100, Food IQ</span>
    </span>
  );
}

function PointList({ items, tone }: { items: NutrientClass[]; tone: "positive" | "attention" }) {
  const Icon = tone === "positive" ? CheckCircle2 : AlertTriangle;
  return (
    <ul className="space-y-1">
      {items.map((c) => (
        <li key={c.id} className="flex items-start gap-1.5 text-sm">
          <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "positive" ? "text-[#5fc49a]" : "text-[#f08a8a]")} aria-hidden />
          <span>{c.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** The top of the product page: the Food IQ rating (when enabled) and the key points, readable in seconds. */
export function FoodIqSummary({ score, enabled, positives, concerns }: { score: FoodIqScore; enabled: boolean; positives: NutrientClass[]; concerns: NutrientClass[] }) {
  return (
    <section aria-labelledby="fiq-title" className="space-y-3 rounded-2xl border border-gold-muted/60 bg-card-gradient p-4" data-testid="food-iq-summary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="fiq-title" className="whitespace-nowrap font-display text-sm font-bold uppercase tracking-[0.14em] text-gold">
          Narrow Gate Food IQ
        </h2>
        {enabled && score.status === "scored" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-gold-muted/60 px-2 py-0.5 text-[0.7rem] font-semibold text-champagne" data-testid="food-iq-experimental">
            <FlaskConical className="size-3" aria-hidden /> Experimental · not yet reviewed
          </span>
        )}
      </div>
      {enabled && score.status === "scored" ? (
        <div className="flex items-center gap-4" data-testid="food-iq-score">
          <ScoreRing score={score.score} band={score.band.id} />
          <div className="min-w-0 space-y-1">
            <p className={cn("inline-block rounded-md border px-2 py-0.5 font-display text-lg font-bold", BAND_STYLE[score.band.id])}>{score.band.label}</p>
            <p className="text-sm">{score.summary}</p>
            <p className="text-xs text-muted-foreground">Rated as: {KIND_LABEL[score.kind]}, per 100 {score.unit}.</p>
          </div>
        </div>
      ) : enabled && score.status === "insufficient" ? (
        <p className="text-sm" data-testid="food-iq-no-score">
          <CircleHelp className="mr-1 inline size-4 text-muted-foreground" aria-hidden />
          Not enough data for a Food IQ rating: {score.missing.join(", ")} {score.missing.length === 1 ? "is" : "are"} missing. Nothing is guessed.
        </p>
      ) : enabled && score.status === "not_applicable" ? (
        <p className="text-sm" data-testid="food-iq-no-score">
          <Info className="mr-1 inline size-4 text-muted-foreground" aria-hidden />
          {score.reason}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="food-iq-pending">
          The Food IQ 0–100 rating is being validated and will appear here once it has been reviewed. Until then, use the recognised indicators and the points below.
        </p>
      )}
      {(positives.length > 0 || concerns.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="food-iq-points">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Strengths</p>
            {positives.length ? <PointList items={positives} tone="positive" /> : <p className="text-sm text-muted-foreground">None stand out.</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">To watch</p>
            {concerns.length ? <PointList items={concerns} tone="attention" /> : <p className="text-sm text-muted-foreground">Nothing high in sugars, salt or saturated fat.</p>}
          </div>
        </div>
      )}
      {enabled && <p className="text-xs text-muted-foreground">{SCORE_MEANING}</p>}
    </section>
  );
}

/** How the rating was worked out: every component, its points and its basis. */
export function FoodIqBreakdown({ score }: { score: FoodIqScore }) {
  if (score.status !== "scored" || score.components.length === 0) return null;
  const formula = score.kind === "beverage" ? "80 + 2.5 × positive points − 2 × points of concern" : "50 + 2.5 × positive points − 1.5 × points of concern";
  return (
    <details className="rounded-2xl border border-border bg-card p-4" data-testid="food-iq-breakdown">
      <summary className="cursor-pointer font-display text-base">How this rating was worked out</summary>
      <div className="mt-3 space-y-3 text-sm">
        <p className="text-muted-foreground">
          Method {score.version}, original to Narrow Gate Fitness. Score = {formula}, from 0 to 100. Positive points are capped at 20 and count less when there&apos;s a lot to watch (here {Math.round(score.positiveFactor * 100)}% counted). Points of concern {score.negativeTotal}, positive points {score.positiveTotal}.
        </p>
        <ul className="space-y-2">
          {score.components.map((c) => (
            <li key={c.key} className="rounded-xl bg-elevated/60 p-2">
              <p className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {c.kind === "negative" ? "−" : "+"} {c.label}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {c.points} / {c.max} pts · {c.value}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">{c.basis}</p>
            </li>
          ))}
        </ul>
        {score.assumptions.length > 0 && (
          <ul className="space-y-1 text-xs text-gold" data-testid="food-iq-assumptions">
            {score.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Bands: 85–100 Excellent, 70–84 Good, 50–69 Moderate, 30–49 Poor, 0–29 Very poor. This is an experimental rating that hasn&apos;t yet been independently reviewed by a nutrition professional. It isn&apos;t medical advice.
        </p>
      </div>
    </details>
  );
}

const EVIDENCE_STYLE: Record<EvidenceClass, string> = {
  regulatory: "border-[#f08a8a]/60 text-[#f08a8a]",
  established: "border-[#e9a066]/60 text-[#e9a066]",
  mixed: "border-gold/60 text-gold",
  no_concern: "border-[#5fc49a]/60 text-[#5fc49a]",
  insufficient: "border-border text-muted-foreground",
};
const EVIDENCE_ICON: Record<EvidenceClass, typeof ShieldAlert> = { regulatory: ShieldAlert, established: AlertTriangle, mixed: CircleHelp, no_concern: ShieldCheck, insufficient: CircleHelp };

export function EvidenceBadge({ cls }: { cls: EvidenceClass }) {
  const Icon = EVIDENCE_ICON[cls];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.7rem] font-semibold", EVIDENCE_STYLE[cls])} title={EVIDENCE_HELP[cls]}>
      <Icon className="size-3" aria-hidden />
      {EVIDENCE_LABEL[cls]}
    </span>
  );
}

/** Ingredients that deserve attention, with what the evidence says (kept separate from what the label says). */
export function IngredientAlertsSection({ alerts, hasIngredients }: { alerts: IngredientAlert[]; hasIngredients: boolean }) {
  return (
    <section aria-labelledby="alerts-title" className="space-y-3 rounded-2xl border border-border bg-card p-4" data-testid="ingredient-alerts">
      <h2 id="alerts-title" className="font-display text-lg">
        Ingredients worth knowing about
      </h2>
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{hasIngredients ? "No additives, added sugars or sodium sources named in the product data." : "Unknown: there's no ingredient list in the product data yet. Check the package."}</p>
      ) : (
        <ul className="space-y-2" data-testid="additives">
          {alerts.map((a) => (
            <li key={a.key} className="rounded-xl border border-border/70 bg-elevated/40 p-3" data-testid={`alert-${a.key}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {a.title} <span className="text-xs font-normal text-muted-foreground">· {a.group}</span>
                </p>
                <div className="flex flex-wrap gap-1">
                  {a.classes.map((c) => (
                    <EvidenceBadge key={c} cls={c} />
                  ))}
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{a.classes.map((c) => EVIDENCE_HELP[c]).join(" ")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{a.code ? `What it's for: ${a.purpose}.` : a.purpose}</p>
              {(a.regulatory || a.concern || a.affected || a.dose || a.sources.length > 0) && (
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer text-gold-highlight">What regulators and the evidence say</summary>
                  <dl className="mt-1 space-y-1">
                    {a.regulatory && (
                      <div>
                        <dt className="inline font-semibold">Regulatory status: </dt>
                        <dd className="inline">{a.regulatory}</dd>
                      </div>
                    )}
                    {a.concern && (
                      <div>
                        <dt className="inline font-semibold">Evidence: </dt>
                        <dd className="inline">{a.concern}</dd>
                      </div>
                    )}
                    {a.affected && (
                      <div>
                        <dt className="inline font-semibold">Who may be affected: </dt>
                        <dd className="inline">{a.affected}</dd>
                      </div>
                    )}
                    {a.dose && (
                      <div>
                        <dt className="inline font-semibold">Does the amount matter? </dt>
                        <dd className="inline">{a.dose}</dd>
                      </div>
                    )}
                    {a.sources.length > 0 && (
                      <div>
                        <dt className="font-semibold">Sources</dt>
                        <dd>
                          <ul className="list-disc pl-5 text-xs text-muted-foreground">
                            {a.sources.map((s) => (
                              <li key={s.label}>
                                {s.url ? (
                                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                                    {s.label}
                                  </a>
                                ) : (
                                  s.label
                                )}
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                  </dl>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        A listed additive isn&apos;t a sign of harm: additives are approved for specific uses and amounts, and risk depends on how much you eat. The product list comes from the label data; the assessments come from the regulators and studies named. Additives this app hasn&apos;t reviewed say &quot;Insufficient information&quot; instead of guessing.
      </p>
    </section>
  );
}

const TONE_STYLE = { positive: "text-[#5fc49a]", neutral: "text-champagne", attention: "text-[#f08a8a]" } as const;

/** Protein, carbs, fat, calories, sugar, fibre and sodium in plain words, each marked legal / guidance / informal. */
export function MacroAnalysis({ p, classes }: { p: QualityProduct; classes: NutrientClass[] }) {
  const s = p.perServing;
  const cells: [string, number | null, number | null, string][] = [
    ["Calories", s?.calories ?? null, p.per100.calories, "kcal"],
    ["Protein", s?.protein_g ?? null, p.per100.protein_g, "g"],
    ["Carbs", s?.carbs_g ?? null, p.per100.carbs_g, "g"],
    ["Fat", s?.fat_g ?? null, p.per100.fat_g, "g"],
  ];
  return (
    <section aria-labelledby="macro-title" className="space-y-3 rounded-2xl border border-border bg-card p-4" data-testid="macro-analysis">
      <h2 id="macro-title" className="font-display text-lg">
        Macro analysis
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map(([label, sv, hv, unit]) => (
          <div key={label} className="rounded-xl bg-elevated/60 p-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-display text-lg font-bold tabular-nums">{sv != null ? `${sv} ${unit}` : hv != null ? `${hv} ${unit}` : "Not available"}</p>
            <p className="text-xs text-muted-foreground">{sv != null ? `per serving · ${hv ?? "?"} ${unit} per 100 ${p.unit}` : `per 100 ${p.unit}`}</p>
          </div>
        ))}
      </div>
      {classes.length ? (
        <ul className="space-y-2" data-testid="nutrient-classes">
          {classes.map((c) => (
            <li key={c.id} className="text-sm" data-testid={`class-${c.id}`}>
              <p className="flex flex-wrap items-baseline gap-2">
                <span className={cn("font-semibold", TONE_STYLE[c.tone])}>{c.label}</span>
                <span className="rounded border border-border px-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">{CLASS_KIND_LABEL[c.kind]}</span>
              </p>
              <p className="text-muted-foreground">{c.detail}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Not enough nutrition data to describe this product.</p>
      )}
      <p className="text-xs text-muted-foreground">
        &quot;EU claim threshold&quot; means the numbers meet the level the EU sets for that claim (Regulation 1924/2006), not that the maker claims it. &quot;UK front-of-pack level&quot; uses the UK traffic-light thresholds. &quot;Comparison&quot; is this app&apos;s plain-language description, explained in each line.
      </p>
    </section>
  );
}

/** Pro: the product against the member's own targets, separate from the general rating. */
export function FitsYourGoals({ fit, allowed, hasAi }: { fit: GoalFit | null; allowed: boolean; hasAi: boolean }) {
  return (
    <section aria-labelledby="fits-title" className="space-y-3 rounded-2xl border border-gold-muted/60 bg-card p-4" data-testid="fits-your-goals">
      <h2 id="fits-title" className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.14em] text-gold">
        <Target className="size-4" aria-hidden /> Fits your goals
      </h2>
      {!allowed || !fit ? (
        <p className="text-sm text-muted-foreground">
          See how a serving counts toward your own calorie, protein, carb, fat, fibre and sodium targets, and whether it suits your diet style. Included with Pro.{" "}
          <Link href="/profile/billing" className="font-semibold text-gold-highlight underline">
            See plans
          </Link>
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">For {fit.basis}. Separate from the Food IQ rating: a food can fit your plan well and still have a modest general rating, or the reverse.</p>
          <ul className="space-y-2" data-testid="goal-rows">
            {fit.rows.map((r) => (
              <li key={r.key} className="grid grid-cols-[6.5rem_1fr] items-center gap-2 text-sm" data-testid={`goal-${r.key}`}>
                <span className="font-semibold">{r.label}</span>
                <div>
                  <p className="tabular-nums">
                    {r.amount == null ? "Not available" : `${r.amount} ${r.unit}`}
                    {r.pct != null && <span className="text-muted-foreground"> · {r.pct}% {r.targetLabel}</span>}
                  </p>
                  {r.pct != null && (
                    <div className="mt-1 h-1.5 rounded-full bg-elevated" aria-hidden>
                      <div className={cn("h-1.5 rounded-full", r.key === "sodium" ? "bg-[#e9a066]" : "bg-gold")} style={{ width: `${Math.min(100, r.pct)}%` }} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {fit.notes.length > 0 && (
            <ul className="space-y-1" data-testid="goal-notes">
              {fit.notes.map((n) => (
                <li key={n.text} className={cn("text-sm", TONE_STYLE[n.tone])}>
                  {n.text}
                </li>
              ))}
            </ul>
          )}
          {fit.conflicts.length > 0 && (
            <ul className="space-y-1" data-testid="goal-conflicts">
              {fit.conflicts.map((c) => (
                <li key={c} className="flex items-start gap-1.5 text-sm text-[#f08a8a]">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Fibre is compared with 14 g per 1,000 kcal of your calorie target and sodium with the 2,300 mg daily limit (US Dietary Guidelines). This is general information, not medical or dietetic advice.
            {hasAi ? " Ask the AI below for a fuller explanation." : ""}
          </p>
        </>
      )}
    </section>
  );
}
