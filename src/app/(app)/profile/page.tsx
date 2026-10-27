import Link from "next/link";
import { Award, ChevronRight, CreditCard, Download, LogOut, SlidersHorizontal } from "lucide-react";
import { WithdrawAiConsentForm } from "@/components/coach/ai-consent";
import { PageHeader } from "@/components/common/page-header";
import { DeleteAccountForm, ProfileForm, WithdrawConsentForm } from "@/components/profile/profile-forms";
import { Button } from "@/components/ui/button";
import { getPlans } from "@/lib/domain/plans";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { signOutAction } from "@/server/actions/auth";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user, profile } = await requireOnboardedUser();
  const plan = await getUserPlan(user.id);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Profile" title={profile.display_name ?? "Profile"} description={user.email} />

      <nav className="grid gap-3 sm:grid-cols-2" aria-label="Profile sections">
        <Link href="/profile/preferences" className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:border-gold-muted">
          <span className="flex items-center gap-3">
            <SlidersHorizontal className="size-5 text-gold" aria-hidden />
            <span>
              <span className="block font-semibold">Training preferences</span>
              <span className="block text-xs text-muted-foreground">Goals, schedule, equipment, diet</span>
            </span>
          </span>
          <ChevronRight className="size-4 text-gold" aria-hidden />
        </Link>
        <Link href="/profile/billing" className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:border-gold-muted">
          <span className="flex items-center gap-3">
            <CreditCard className="size-5 text-gold" aria-hidden />
            <span>
              <span className="block font-semibold">Plans &amp; billing</span>
              <span className="block text-xs text-muted-foreground">Current plan: {getPlans()[plan].name}</span>
            </span>
          </span>
          <ChevronRight className="size-4 text-gold" aria-hidden />
        </Link>
        <Link href="/progress/badges" className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:border-gold-muted">
          <span className="flex items-center gap-3">
            <Award className="size-5 text-gold" aria-hidden />
            <span>
              <span className="block font-semibold">Badges</span>
              <span className="block text-xs text-muted-foreground">Achievements earned from your training</span>
            </span>
          </span>
          <ChevronRight className="size-4 text-gold" aria-hidden />
        </Link>
      </nav>

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="account-title">
        <h2 id="account-title" className="mb-4 font-display text-xl font-bold uppercase">
          Account
        </h2>
        <ProfileForm
          initial={{
            displayName: profile.display_name ?? "",
            unitSystem: profile.unit_system,
            heightCm: profile.height_cm ? Number(profile.height_cm) : null,
            timezone: profile.timezone,
            faithEnabled: profile.faith_enabled,
          }}
        />
        <p className="mt-4 text-xs text-muted-foreground">
          Need to change your password? Use{" "}
          <Link href="/forgot-password" className="text-gold-highlight underline">
            password reset
          </Link>
          .
        </p>
      </section>

      <section className="space-y-5 rounded-2xl border border-border bg-card p-5" aria-labelledby="privacy-title">
        <h2 id="privacy-title" className="font-display text-xl font-bold uppercase">
          Privacy &amp; data
        </h2>
        <p className="text-xs text-muted-foreground">
          Read how we collect, use, share and delete your information in our{" "}
          <Link href="/legal/privacy" className="text-gold-highlight underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/legal/terms" className="text-gold-highlight underline">
            Terms of Service
          </Link>
          .
        </p>
        <div>
          <p className="text-sm font-semibold">Export your data</p>
          <p className="mb-2 text-xs text-muted-foreground">Download your account data as a JSON file. Photos are included as private download links.</p>
          <Button asChild variant="secondary">
            <a href="/api/account/export" download>
              <Download aria-hidden /> Download my data
            </a>
          </Button>
        </div>
        <div>
          <p className="text-sm font-semibold">Optional wellness information</p>
          <p className="mb-2 text-xs text-muted-foreground">
            {profile.wellness_consent_at
              ? `You gave consent on ${new Date(profile.wellness_consent_at).toLocaleDateString()}. Withdrawing deletes limitation notes and recovery check-ins.`
              : "You haven't consented to storing optional wellness information."}
          </p>
          {profile.wellness_consent_at && <WithdrawConsentForm />}
        </div>
        <div>
          <p className="text-sm font-semibold">AI coach data sharing</p>
          <p className="mb-2 text-xs text-muted-foreground">
            {profile.ai_consent_at
              ? `You agreed on ${new Date(profile.ai_consent_at).toLocaleDateString()} to share coach messages and a training summary with our AI provider, Anthropic. Turning this off stops all sharing; your saved conversations stay until you delete them.`
              : "You haven't agreed to share data with the AI coach provider. The coach asks before you send your first message."}
          </p>
          {profile.ai_consent_at && <WithdrawAiConsentForm />}
        </div>
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-semibold text-[#f08a8a]">Delete account</p>
          <p className="mb-3 text-xs text-muted-foreground">This cancels any active subscription and permanently deletes your account and data. It can&apos;t be undone.</p>
          <DeleteAccountForm />
        </div>
      </section>

      <form action={signOutAction}>
        <Button type="submit" variant="ghost" className="w-full">
          <LogOut aria-hidden /> Sign out
        </Button>
      </form>
    </div>
  );
}
