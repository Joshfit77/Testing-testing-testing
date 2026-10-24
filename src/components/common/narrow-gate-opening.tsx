import Link from "next/link";

/**
 * Animated opening for the public landing page and the independent /intro demo route.
 * CSS-only, so a real browser plays it; a screenshot viewer must explicitly keep this
 * animation live rather than substituting a still capture.
 */
export function NarrowGateOpening({
  verse,
  translation,
  continueHref = "#welcome",
  continueLabel = "Enter Narrow Gate Fitness",
}: {
  verse: string;
  translation: string;
  continueHref?: string;
  continueLabel?: string;
}) {
  return (
    <section
      aria-label="Narrow Gate Fitness opening"
      data-testid="narrow-gate-opening"
      className="ng-intro relative isolate mx-auto flex min-h-[min(760px,calc(100svh-5rem))] w-full flex-col items-center justify-center overflow-hidden px-4 py-10 text-center sm:py-14"
    >
      <div className="ng-intro-aura" aria-hidden="true" />
      <div className="ng-intro-art relative mb-5" data-testid="animated-narrow-door" aria-hidden="true">
        <div className="ng-intro-ground" />
        <div className="ng-intro-arch">
          <div className="ng-intro-light" />
          <div className="ng-intro-door">
            <span className="ng-intro-panel-edge" />
            <span className="ng-intro-handle" />
          </div>
        </div>
      </div>

      <p className="ng-intro-copy mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.34em] text-gold sm:text-xs">
        Rooted in faith. Built for strength.
      </p>
      <h2 className="ng-intro-copy max-w-2xl font-display text-3xl font-extrabold uppercase leading-[1.04] tracking-[0.04em] text-white sm:text-5xl">
        Enter through the <span className="text-gold-gradient">narrow gate</span>
      </h2>
      <figure className="ng-intro-copy mt-5 max-w-[35rem]">
        <blockquote className="font-serif text-[0.98rem] leading-relaxed text-[#f1ead6] sm:text-lg">
          &ldquo;{verse}&rdquo;
        </blockquote>
        <figcaption className="mt-2 text-xs font-semibold tracking-wide text-gold">
          Matthew 7:13–14 ({translation})
        </figcaption>
      </figure>

      <Link
        href={continueHref}
        className="ng-intro-copy mt-6 inline-flex min-h-12 items-center justify-center rounded-xl border border-gold bg-gold-gradient px-7 text-sm font-extrabold uppercase tracking-[0.12em] text-[#100d07] shadow-[0_10px_30px_-15px_rgba(241,223,168,0.8)] transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-highlight"
      >
        {continueLabel}
      </Link>
      <p className="ng-intro-copy mt-3 text-xs text-muted-foreground">
        The opening can be skipped at any time. No account is required to view it.
      </p>
    </section>
  );
}
