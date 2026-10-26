import Link from "next/link";
import { AcceptTermsForm } from "@/components/auth/accept-terms-form";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Updated terms" };

/** Shown when the owner has switched on re-acceptance after a material change to the Terms or Privacy Policy. */
export default async function AcceptTermsPage() {
  await requireUser();
  return (
    <>
      <h1>We&apos;ve updated our terms</h1>
      <p>
        Please review the updated{" "}
        <Link href="/legal/terms" className="text-gold-highlight underline" target="_blank">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="text-gold-highlight underline" target="_blank">
          Privacy Policy
        </Link>
        , then confirm below to continue. Your data and membership are unchanged.
      </p>
      <AcceptTermsForm />
    </>
  );
}
