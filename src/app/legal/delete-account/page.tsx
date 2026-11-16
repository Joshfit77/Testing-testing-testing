import Link from "next/link";

export const metadata = { title: "Delete your account" };

/**
 * A public page that explains how to delete an account and its data, reachable without the app (Google Play asks for
 * a web address for this; Apple asks that deletion can be started in the app, which it can). The steps describe what
 * `deleteUserAccount` (src/server/services/account-deletion.ts) does. A contact address for people who can no longer
 * sign in is still to be supplied by the owner: see docs/legal/REMAINING_INFORMATION_NEEDED.md.
 */
export default function DeleteAccountInfoPage() {
  return (
    <>
      <h1>Delete your account</h1>
      <p>You can delete your Narrow Gate Fitness account and the data in it at any time, from the app or from this website.</p>
      <h2>How to delete it</h2>
      <ul>
        <li>
          <Link href="/login?next=/profile%23privacy" className="text-gold-highlight underline">
            Sign in
          </Link>{" "}
          and open <strong>You</strong>.
        </li>
        <li>Scroll to <strong>Privacy &amp; data</strong>.</li>
        <li>If you want a copy first, choose <strong>Download my data</strong> under Export your data.</li>
        <li>
          Under <strong>Delete account</strong>, type DELETE, enter your password and confirm.
        </li>
      </ul>
      <h2>What is deleted</h2>
      <p>
        Your profile, workouts, runs and routes, food diary, recipes and meal plans, bodyweight and measurements, progress photos, Body Scan photos, sleep and
        recovery records, AI Coach conversations and memories, prayer journal, Bible highlights and notes, reminders and settings. Deletion can&apos;t be undone.
      </p>
      <h2>What is not deleted by this step</h2>
      <ul>
        <li>
          A subscription billed by Apple or Google. Deleting your account does not cancel it: cancel it in your App Store or Google Play subscriptions. A
          subscription bought on this website is cancelled for you when you delete your account.
        </li>
        <li>Information already sent to the AI provider while the AI Coach was on cannot be recalled by deleting your account.</li>
      </ul>
      <p>
        See the <Link href="/legal/privacy" className="text-gold-highlight underline">Privacy Policy</Link> for details.
      </p>
    </>
  );
}
