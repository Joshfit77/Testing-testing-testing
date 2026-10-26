import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, Check, Dumbbell, HeartPulse, LineChart, Salad, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { NarrowGateArt } from "@/components/common/narrow-gate-art";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { formatPrice, getPlans, PUBLIC_PLAN_ORDER, yearlySavingsPercent } from "@/lib/domain/plans";
import { getCurrentUser } from "@/server/auth";
import { ForgetDeviceData } from "@/components/platform/forget-device-data";
import { TRANSLATION } from "@/data/content";
import { scriptureText } from "@/data/scripture";

const GATE_VERSE = scriptureText(
  "Matthew 7:13–14",
  "Enter through the narrow gate. For wide is the gate and broad is the way that leads to destruction, and many enter through it. But small is the gate and narrow the way that leads to life, and only a few find it.",
);

const FEATURES = [
  { icon: Dumbbell, title: "Programs that adapt", body: "Strength, hypertrophy, strongman, combat conditioning, mobility and more — matched to your goals and equipment." },
  { icon: HeartPulse, title: "Log every rep", body: "A fast workout logger with rest timer, substitutions and personal records. Your session survives reloads." },
  { icon: Bot, title: "AI coach (Pro)", body: "Ask about technique, progression and recovery using your own log. Suggested changes are saved only when you approve them." },
  { icon: Salad, title: "Free food tracking", body: "Search a USDA-based food database, scan barcodes and track calories, macros and water — free. Estimates are clearly labeled." },
  { icon: LineChart, title: "Progress you can see", body: "Bodyweight, lift trends, volume and consistency charts with 7-day to 1-year views." },
  { icon: ShieldCheck, title: "Private by design", body: "Your data is isolated to your account. Export or delete it any time." },
];

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (user) redirect("/home");
  }
  const plans = getPlans();

  return (
    <div className="min-h-dvh">
      {/* After account deletion, also forget the drafts and workout copy kept on this device. */}
      {deleted === "1" && <ForgetDeviceData />}
      <header className="safe-top mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:h-20 md:px-8">
        <Link href="/" aria-label="Narrow Gate Fitness">
          <Logo compact className="md:hidden" />
          <Logo className="hidden md:inline-flex" />
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      <main>
        {/* The welcome screen is the opening's last frame held still: brand, the open gate, the verse beneath it. */}
        <section className="hero-glow relative overflow-hidden" aria-labelledby="welcome-title">
          <div className="mx-auto flex max-w-2xl flex-col items-center px-4 pb-16 pt-1 text-center md:pb-24 md:pt-4">
            <h1 id="welcome-title" className="animate-fade-up flex flex-col items-center gap-2 leading-none">
              <span className="whitespace-nowrap pl-[0.2em] font-serif text-[1.55rem] font-semibold uppercase tracking-[0.2em] text-gold-gradient md:text-[2rem]">Narrow Gate</span>{" "}
              <span className="pl-[0.55em] text-[0.68rem] font-semibold uppercase tracking-[0.55em] text-muted-foreground md:text-xs">Fitness</span>
            </h1>
            <p className="animate-fade-up mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-gold md:text-xs">Rooted in faith. Built for strength.</p>
            <NarrowGateArt still className="mt-5 h-[clamp(170px,29svh,360px)] md:mt-8 md:h-[clamp(240px,38svh,400px)] [@media(max-height:700px)]:mt-3" />
            <figure className="animate-fade-up mt-7 max-w-[34rem] [animation-delay:80ms] [@media(max-height:700px)]:mt-5">
              <blockquote className="font-serif text-[1.03rem] leading-[1.62] text-[#f1ead6] md:text-xl">&ldquo;{GATE_VERSE}&rdquo;</blockquote>
              <figcaption className="mt-3 text-[0.72rem] font-bold uppercase tracking-[0.22em] text-gold">Matthew 7:13–14 ({TRANSLATION.code})</figcaption>
            </figure>
            <div className="animate-fade-up mt-8 grid w-full max-w-sm grid-cols-2 gap-3 [animation-delay:140ms] [@media(max-height:700px)]:mt-5">
              <Button asChild size="lg">
                <Link href="/signup">Start free</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
            <p className="mt-6 max-w-md text-sm text-muted-foreground">
              Premium training programs, precise workout tracking, nutrition and an AI coach, for every athlete, whatever you
              believe. An optional faith and discipline section is there if you want it.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8" aria-labelledby="features-title">
          <h2 id="features-title" className="font-display text-3xl font-bold uppercase tracking-wide">
            Everything you need to train well
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card-gradient rounded-2xl border border-border p-6">
                <f.icon className="size-6 text-gold" aria-hidden />
                <h3 className="mt-4 font-display text-lg font-semibold uppercase tracking-wide">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 md:px-8" aria-labelledby="pricing-title">
          <h2 id="pricing-title" className="font-display text-3xl font-bold uppercase tracking-wide">
            Simple plans
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">Free to build your foundation. One membership for every premium feature.</p>
          <div className="mt-8 grid max-w-4xl gap-4 md:grid-cols-2">
            {PUBLIC_PLAN_ORDER.map((id) => {
              const p = plans[id];
              const featured = id === "pro";
              return (
                <div
                  key={id}
                  className={featured ? "rounded-2xl border border-gold-muted bg-card-gradient p-6 shadow-[0_20px_60px_-30px_rgba(201,165,76,0.6)]" : "rounded-2xl border border-border bg-card p-6"}
                >
                  <p className="font-display text-xl font-semibold uppercase tracking-wider text-gold-highlight">{p.name}</p>
                  <p className="mt-2 text-3xl font-bold">
                    {formatPrice(p.priceCents)}
                    {p.priceCents > 0 && <span className="text-sm font-normal text-muted-foreground"> / month</span>}
                  </p>
                  {p.yearlyPriceCents ? (
                    <p className="text-sm">
                      or {formatPrice(p.yearlyPriceCents)} / year <span className="text-muted-foreground">(save {yearlySavingsPercent(p.priceCents, p.yearlyPriceCents)}%)</span>
                    </p>
                  ) : null}
                  {featured && <p className="mt-1 text-xs text-muted-foreground">Renews automatically until cancelled. Monthly and yearly include the same features.</p>}
                  <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
                  <ul className="mt-5 space-y-2 text-sm">
                    {p.highlights.map((h) => (
                      <li key={h} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden /> {h}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <p>© {new Date().getFullYear()} Narrow Gate Fitness. Not medical advice — consult a professional before starting a new program.</p>
          <nav className="flex gap-4">
            <Link href="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/legal/notices" className="hover:text-foreground">
              Notices
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
