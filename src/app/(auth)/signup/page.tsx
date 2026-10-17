import Link from "next/link";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  const defaultEmail = typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
  return (
    <div className="animate-fade-up pt-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Rooted in faith. Built for strength.</p>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase">Create your account</h1>
      <figure className="mt-4 rounded-r-xl border-l-4 border-gold bg-[#15120b] px-4 py-3">
        <blockquote className="font-serif text-base text-[#f1ead6]">&ldquo;I can do all things through Christ which strengtheneth me.&rdquo;</blockquote>
        <figcaption className="mt-1 text-xs font-semibold text-gold">Philippians 4:13 (KJV)</figcaption>
      </figure>
      <p className="mt-2 text-sm text-muted-foreground">Free forever plan. No card required. Next, we&apos;ll ask your weight, age, sex and height to set up your plan.</p>
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <SignUpForm defaultEmail={defaultEmail} />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-gold-highlight hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
