"use client";

import { Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BadgeArt } from "@/components/badges/badge-art";
import { RankLadder } from "@/components/badges/rank-ladder";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProgressBar } from "@/components/ui/progress-bar";
import Link from "next/link";
import { RANK_CATEGORIES, type PlanCategoryProgress, type PlanRankState, type RankCategory, type RankState } from "@/lib/domain/ranks";
import { cn } from "@/lib/utils";

/** Verse text (BSB) and translation code for each reference used by the ranks, read on the server. */
export type RankVerses = Record<string, string>;

const SEEN_KEY = "ngf.rankSeen";

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    // Private mode or storage blocked: the reveal may show again, nothing else is affected.
  }
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

const rankId = (r: Pick<RankState, "category" | "level">) => `${r.category}-${r.level}`;

function requirement(r: RankState): string {
  const info = RANK_CATEGORIES.find((c) => c.id === r.category)!;
  const noun = r.threshold === 1 ? info.unit[0] : info.unit[1];
  if (r.category === "fitness") return r.threshold === 1 ? "Complete your first workout." : `Complete ${r.threshold.toLocaleString("en-US")} workouts.`;
  if (r.category === "food") return r.threshold === 1 ? "Log food on your first day." : `Log food on ${r.threshold.toLocaleString("en-US")} different days.`;
  return r.threshold === 1 ? "Take part in Faith for the first time." : `Take part in Faith on ${r.threshold.toLocaleString("en-US")} ${noun}.`;
}

export function RankBoard({ progress, verses, translation, initial = "fitness", today }: { progress: PlanCategoryProgress[]; verses: RankVerses; translation: string; initial?: RankCategory; today: string }) {
  const [tab, setTab] = useState<RankCategory>(initial);
  const [open, setOpen] = useState<PlanRankState | null>(null);
  const [reveal, setReveal] = useState<RankState | null>(null);
  const byCat = useMemo(() => new Map(progress.map((p) => [p.category, p])), [progress]);
  const current = byCat.get(tab)!;
  const info = RANK_CATEGORIES.find((c) => c.id === tab)!;

  // Celebrate a rank reached in the last week once per device (the highest new one).
  useEffect(() => {
    const seen = readSeen();
    const earned = progress.flatMap((p) => p.ranks.filter((r) => r.earned));
    if (!localStorage.getItem(SEEN_KEY)) {
      // First visit after this update: treat everything already earned as seen, so nothing old is "new".
      writeSeen(new Set(earned.map(rankId)));
      return;
    }
    const weekAgo = new Date(`${today}T00:00:00Z`);
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    const since = weekAgo.toISOString().slice(0, 10);
    const fresh = earned.filter((r) => !seen.has(rankId(r)) && (r.earnedAt ?? "") >= since).sort((a, b) => b.level - a.level);
    for (const r of earned) seen.add(rankId(r));
    writeSeen(seen);
    if (fresh[0]) setReveal(fresh[0]);
  }, [progress, today]);

  return (
    <section aria-labelledby="ranks-title" className="space-y-4">
      <h2 id="ranks-title" className="sr-only">
        Ranks
      </h2>
      <div role="tablist" aria-label="Badge categories" className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-card p-1">
        {RANK_CATEGORIES.map((c) => {
          const p = byCat.get(c.id)!;
          const active = c.id === tab;
          return (
            <button
              key={c.id}
              role="tab"
              type="button"
              id={`rank-tab-${c.id}`}
              aria-selected={active}
              aria-controls={`rank-panel-${c.id}`}
              onClick={() => setTab(c.id)}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-xl px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                active ? "bg-gold/15 text-gold-highlight shadow-[inset_0_0_0_1px_rgba(201,165,76,0.55)]" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
              <span className="mt-0.5 text-[0.7rem] font-medium normal-case tracking-normal text-muted-foreground">
                {p.current ? `Rank ${p.current.level} of 9` : "Not started"}
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`rank-panel-${tab}`} aria-labelledby={`rank-tab-${tab}`} key={tab} className="animate-fade-up space-y-4">
        <button
          type="button"
          onClick={() => setOpen(current.current ?? current.ranks[0]!)}
          className="relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-gold-muted/60 bg-card-gradient p-4 text-left shadow-[0_18px_50px_-30px_rgba(201,165,76,0.7)]"
        >
          <div className="pointer-events-none absolute -left-10 -top-10 size-48 rounded-full bg-gold/10 blur-3xl" aria-hidden />
          <BadgeArt category={tab} level={current.current?.level ?? 1} size={60} locked={!current.current} animate={Boolean(current.current)} />
          <div className="relative min-w-0 flex-1">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-gold">{info.subtitle}</p>
            <p className="mt-0.5 font-display text-2xl font-bold">{current.current ? current.current.name : "Your first rank awaits"}</p>
            <p className="text-sm text-muted-foreground">
              {current.current ? `Rank ${current.current.level} of 9` : `Start with ${current.ranks[0]!.name}`} · {current.count.toLocaleString("en-US")}{" "}
              {current.count === 1 ? info.unit[0] : info.unit[1]}
            </p>
            {current.next ? (
              <div className="mt-2 space-y-1">
                <ProgressBar value={current.percentToNext} label={`Progress to ${current.next.name}`} />
                <p className="text-xs text-muted-foreground">
                  {(current.next.threshold - current.count).toLocaleString("en-US")} more to <span className="font-semibold text-foreground">{current.next.name}</span>
                </p>
              </div>
            ) : current.ranks.some((r) => r.planLocked) ? (
              <p className="mt-2 text-xs font-semibold text-gold-highlight">Every Free rank earned. Plus unlocks the rest.</p>
            ) : (
              <p className="mt-2 text-xs font-semibold text-gold-highlight">Every rank earned.</p>
            )}
          </div>
        </button>
        <p className="text-xs text-muted-foreground">{info.counts}</p>

        <RankLadder progress={current} onOpen={setOpen} verses={verses} translation={translation} />
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        {open ? (
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <RankDetail rank={open} progress={byCat.get(open.category)!} verse={verses[open.reference]} translation={translation} />
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={reveal !== null} onOpenChange={(o) => !o && setReveal(null)}>
        {reveal ? (
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <RankReveal rank={reveal} verse={verses[reveal.reference]} translation={translation} onClose={() => setReveal(null)} />
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}

function VerseBlock({ reference, verse, translation }: { reference: string; verse: string | undefined; translation: string }) {
  return (
    <figure className="rounded-xl border border-gold-muted/40 bg-[#14110a] px-4 py-3">
      {verse ? <blockquote className="font-serif text-[0.95rem] leading-relaxed text-[#f1ead6]">{verse}</blockquote> : null}
      <figcaption className="mt-1.5 text-xs font-semibold text-gold">
        {reference} ({translation})
      </figcaption>
    </figure>
  );
}

function RankDetail({ rank, progress, verse, translation }: { rank: PlanRankState; progress: PlanCategoryProgress; verse: string | undefined; translation: string }) {
  const info = RANK_CATEGORIES.find((c) => c.id === rank.category)!;
  const pct = rank.earned ? 100 : Math.min(100, Math.round((progress.count / rank.threshold) * 100));
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center text-center">
        <div className={cn("rank-detail-art", rank.earned ? "is-earned" : "is-locked")}>
          <BadgeArt category={rank.category} level={rank.level} size={150} locked={!rank.earned} animate={rank.earned} />
          {rank.earned ? null : (
            <span className="rank-detail-lock">
              <Lock aria-hidden /> Locked
            </span>
          )}
        </div>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          {info.label} · Rank {rank.level} of 9
        </p>
        <DialogTitle className="font-display text-2xl font-bold">{rank.name}</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">{rank.theme}</DialogDescription>
      </div>
      <VerseBlock reference={rank.reference} verse={verse} translation={translation} />
      <div className="space-y-2 rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To unlock</p>
        <p className="text-sm">{requirement(rank)}</p>
        {rank.earned && rank.earnedAt ? (
          <p className="text-sm font-semibold text-gold-highlight">Earned {formatDate(rank.earnedAt)}</p>
        ) : (
          <>
            <ProgressBar value={pct} label={`${rank.name} progress`} />
            <p className="text-xs text-muted-foreground">
              {Math.min(progress.count, rank.threshold).toLocaleString("en-US")} / {rank.threshold.toLocaleString("en-US")} {rank.threshold === 1 ? info.unit[0] : info.unit[1]}
            </p>
          </>
        )}
      </div>
      {rank.planLocked ? (
        <p className="rounded-xl border border-gold-muted/50 bg-gold/5 p-3 text-sm">
          Ranks 4–9 are included with Plus and Pro.{" "}
          {rank.reached ? "You've already reached this one — it appears as soon as you upgrade." : "Your progress keeps counting on Free."}{" "}
          <Link href="/profile/billing" className="font-semibold text-gold-highlight underline-offset-4 hover:underline">
            See plans
          </Link>
        </p>
      ) : null}
      {rank.category === "faith" ? (
        <p className="text-xs text-muted-foreground">Faith ranks celebrate showing up. They don&apos;t measure your faith or your worth to God.</p>
      ) : null}
    </div>
  );
}

function RankReveal({ rank, verse, translation, onClose }: { rank: RankState; verse: string | undefined; translation: string; onClose: () => void }) {
  const info = RANK_CATEGORIES.find((c) => c.id === rank.category)!;
  const top = rank.level === 9;
  return (
    <div className="space-y-4 text-center">
      {/* Rings and glow stack in one grid cell, centred on the art. */}
      <div className="mx-auto grid place-items-center [&>*]:[grid-area:1/1]">
        <span className="badge-reveal-ring size-44 rounded-full border-2 border-gold/70" aria-hidden />
        {top ? <span className="badge-reveal-ring size-52 rounded-full border border-gold/50 [animation-delay:0.35s]" aria-hidden /> : null}
        <span className={cn("h-28 w-56 rounded-full blur-2xl", top ? "bg-gold/35" : "bg-gold/20")} aria-hidden />
        <div className="badge-reveal relative">
          <BadgeArt category={rank.category} level={rank.level} size={140} animate />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{top ? `The highest ${info.label} rank` : `New ${info.label} rank`}</p>
        <DialogTitle className="mt-1 font-display text-3xl font-bold">{rank.name}</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Rank {rank.level} of 9 · {rank.theme}
        </DialogDescription>
      </div>
      <VerseBlock reference={rank.reference} verse={verse} translation={translation} />
      <button type="button" onClick={onClose} className="min-h-11 w-full rounded-xl bg-gold-gradient px-4 font-semibold text-black">
        Continue
      </button>
    </div>
  );
}
