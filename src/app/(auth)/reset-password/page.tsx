import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { Notice } from "@/components/common/states";
import { getCurrentUser } from "@/server/auth";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  return (
    <div className="animate-fade-up pt-6">
      <h1 className="font-display text-4xl font-bold uppercase">New password</h1>
      {user ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <ResetPasswordForm />
        </div>
      ) : (
        <Notice tone="warning" className="mt-6">
          Your reset link has expired or was opened in a different browser.{" "}
          <Link href="/forgot-password" className="font-semibold text-gold-highlight underline">
            Request a new link
          </Link>
          .
        </Notice>
      )}
    </div>
  );
}
