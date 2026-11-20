import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { Notice } from "@/components/common/states";
import { getCurrentUser, sessionOpenedByRecentEmailLink } from "@/server/auth";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  // Signed in, but not through a reset link just now (for example a normal sign-in on this phone): no form.
  const fromResetLink = user ? await sessionOpenedByRecentEmailLink() : false;
  return (
    <div className="animate-fade-up pt-6">
      <h1 className="font-display text-4xl font-bold uppercase">New password</h1>
      {user && fromResetLink ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <ResetPasswordForm />
        </div>
      ) : user ? (
        <Notice tone="warning" className="mt-6">
          For your security, a new password can only be set from the link in a reset email.{" "}
          <Link href="/forgot-password" className="font-semibold text-gold-highlight underline">
            Send me a reset link
          </Link>
          .
        </Notice>
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
