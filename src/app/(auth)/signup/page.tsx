import Link from "next/link";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <div className="animate-fade-up pt-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Rooted in faith. Built for strength.</p>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase">Start training</h1>
      <p className="mt-2 text-sm text-muted-foreground">Free forever plan. No card required.</p>
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <SignUpForm />
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
