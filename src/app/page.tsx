import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, Check, Dumbbell, HeartPulse, LineChart, Salad, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { formatPrice, getPlans, PLAN_ORDER, yearlySavingsPercent } from "@/lib/domain/plans";
import { getCurrentUser } from "@/server/auth";

const FEATURES = [
  { icon: Dumbbell, title: "Programs that adapt", body: "Strength, hypertrophy, strongman, combat conditioning, mobility and more — matched to your goals and equipment." },
  { icon: HeartPulse, title: "Log every rep", body: "A fast workout logger with rest timer, substitutions and personal records. Your session survives reloads." },
  { icon: Bot, title: "AI coach", body: "Ask about technique, progression and recovery. Plan changes are always previewed before they're saved." },
  { icon: Salad, title: "Food tracking", body: "Log meals from 90+ common foods or your own, and track calories, macros and water. Estimates are clearly labeled." },
  { icon: LineChart, title: "Progress you can see", body: "Bodyweight, lift trends, volume and consistency charts with 7-day to 1-year views." },
  { icon: ShieldCheck, title: "Private by design", body: "Your data is isolated to your account. Export or delete it any time." },
];

export default async function LandingPage() {
  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (user) redirect("/home");
  }
  const plans = getPlans();

  return (
    <div className="min-h-dvh">
      <header className="safe-top mx-auto flex h-20 max-w-6xl items-center justify-between px-4 md:px-8">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Start free</Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="hero-glow relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 pb-20 pt-14 md:px-8 md:pb-28 md:pt-24">
            <p className="animate-fade-up text-xs font-semibold uppercase tracking-[0.4em] text-gold">Welcome · Rooted in faith. Built for strength.</p>
            <h1 className="animate-fade-up mt-4 max-w-3xl font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight md:text-7xl">
              Choose the <span className="text-gold-gradient">narrow way</span>. Train with purpose.
            </h1>
            <p className="animate-fade-up mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
              Premium training programs, precise workout tracking, nutrition and an AI coach — for every athlete, whatever you
              believe. An optional faith and discipline section is there if you want it.
            </p>
            <form action="/signup" method="get" className="animate-fade-up mt-8 max-w-xl rounded-2xl border border-gold-muted/50 bg-card/80 p-3 backdrop-blur [animation-delay:120ms] sm:flex sm:items-center sm:gap-2">
              <label htmlFor="welcome-email" className="sr-only">
                Email
              </label>
              <input
                id="welcome-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="Enter your email"
                className="h-13 w-full rounded-xl border border-border bg-background px-4 text-base outline-none focus-visible:border-gold sm:flex-1"
              />
              <Button type="submit" size="lg" className="mt-2 w-full sm:mt-0 sm:w-auto">
                Sign up free
              </Button>
            </form>
            <p className="mt-4 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-gold-highlight hover:underline">
                Sign in
              </Link>
            </p>
            <p className="mt-6 text-xs text-muted-foreground">
              Inspired by Matthew 7:13–14 — &ldquo;strait is the gate, and narrow is the way, which leadeth unto life.&rdquo; (KJV)
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
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PLAN_ORDER.map((id) => {
              const p = plans[id];
              const featured = id === "plus";
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
            {plans.pro.yearlyPriceCents ? (
              <div className="rounded-2xl border border-gold-muted bg-card-gradient p-6">
                <p className="font-display text-xl font-semibold uppercase tracking-wider text-gold-highlight">All Access Yearly</p>
                <p className="mt-2 text-3xl font-bold">
                  {formatPrice(plans.pro.yearlyPriceCents)}
                  <span className="text-sm font-normal text-muted-foreground"> / year</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Everything, billed once a year. Save {yearlySavingsPercent(plans.pro.priceCents, plans.pro.yearlyPriceCents)}%.</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {["Everything in Pro", "All programs, food tracking & analytics", "Full AI coaching & plan generation"].map((h) => (
                    <li key={h} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden /> {h}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
          </nav>
        </div>
      </footer>
    </div>
  );
}
