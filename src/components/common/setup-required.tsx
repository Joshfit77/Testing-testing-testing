import { Logo } from "./logo";

/** Shown instead of the app when required environment configuration is missing. */
export function SetupRequired() {
  return (
    <main className="hero-glow flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6">
        <Logo />
        <h1 className="mt-6 font-display text-2xl font-bold uppercase">Setup required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Supabase isn&apos;t configured yet. Copy <code className="text-gold-highlight">.env.example</code> to{" "}
          <code className="text-gold-highlight">.env.local</code> and set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then restart the dev server. See <code>SETUP.md</code> for the full guide,
          including running Supabase locally.
        </p>
      </div>
    </main>
  );
}
