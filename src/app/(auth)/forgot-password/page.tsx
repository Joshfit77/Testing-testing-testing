import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="animate-fade-up pt-6">
      <h1 className="font-display text-4xl font-bold uppercase">Reset password</h1>
      <p className="mt-2 text-sm text-muted-foreground">We&apos;ll email you a secure link to choose a new password.</p>
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-gold-highlight hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
