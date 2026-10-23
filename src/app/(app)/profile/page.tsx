import Link from "next/link";
import { BellRing, ChevronRight, CreditCard, Download, KeyRound, LogOut, SlidersHorizontal, TrendingUp } from "lucide-react";
import { MainHeader } from "@/components/shell/main-header";
import { DisplaySettings } from "@/components/profile/display-settings";
import { DeleteAccountForm, ProfileForm, WithdrawConsentForm, AiConsentOffForm } from "@/components/profile/profile-forms";
import { WorkoutReminders } from "@/components/profile/workout-reminders";
import { Button } from "@/components/ui/button";
import { getPlans } from "@/lib/domain/plans";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { signOutAction } from "@/server/actions/auth";

export const metadata = { title: "Profile & Settings" };

const section = "rounded-2xl border border-border bg-card p-4 md:p-5";
const h2 = "mb-3 text-lg font-semibold";

function Row({ href, icon: Icon, title, body }: { href: string; icon: typeof ChevronRight; title: string; body: string }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-elevated/50">
      <Icon className="size-5 shrink-0 text-gold" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{body}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
    </Link>
  );
}

export default async function ProfilePage() {
  const { user, profile } = await requireOnboardedUser();
  const plan = await getUserPlan(user.id);
  const plans = getPlans();
  const supabase = await getServerSupabase();
  const { data: ent } = await supabase.from("user_entitlements").select("source").eq("user_id", user.id).maybeSingle();
  // Account deletion can't cancel an App Store or Google Play subscription (App Store guideline 5.1.1(v)).
  const storeBilled = plan !== "free" && (ent?.source === "app_store" || ent?.source === "play_store") ? (ent.source === "app_store" ? "App Store" : "Google Play") : null;
  return (
    <div className="space-y-4">
      <MainHeader title="Profile & Settings" subtitle={<span className="block truncate">{user.email}</span>} />

      <nav aria-label="Profile sections" className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        <Row href="/profile/preferences" icon={SlidersHorizontal} title="Edit onboarding details" body="Goals (main and second), schedule, equipment, diet, body and display" />
        <Row href="/profile/billing" icon={CreditCard} title="Plans & billing" body={`Current plan: ${getPlans()[plan].name}`} />
        <Row href="/progress" icon={TrendingUp} title="My Progress" body="Overview, badges and history" />
      </nav>

      <section id="account" className={section} aria-labelledby="account-title">
        <h2 id="account-title" className={h2}>
          Account &amp; units
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
        <Link href="/forgot-password" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gold-highlight hover:underline">
          <KeyRound className="size-4" aria-hidden /> Change password
        </Link>
      </section>

      <section id="display" className={section} aria-labelledby="display-title">
        <h2 id="display-title" className={h2}>
          Display &amp; Faith
        </h2>
        <DisplaySettings
          initial={{ textSize: profile.text_size ?? "default", reduceMotion: profile.reduce_motion ?? false, homeScripture: profile.home_scripture ?? true }}
        />
      </section>

      <div id="reminders" className="space-y-2">
        <WorkoutReminders faithEnabled={profile.faith_enabled} />
        <Link href="/faith/reminders" className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-gold-muted">
          <BellRing className="size-5 shrink-0 text-gold" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Faith reminders</span>
            <span className="block text-sm text-muted-foreground">Devotional, prayer and practice reminders (optional)</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
        </Link>
      </div>

      <section id="privacy" className={`${section} space-y-5`} aria-labelledby="privacy-title">
        <h2 id="privacy-title" className="text-lg font-semibold">
          Privacy &amp; data
        </h2>
        <div>
          <p className="font-semibold">Export your data</p>
          <p className="mb-2 text-sm text-muted-foreground">Download everything stored for your account as a JSON file.</p>
          <Button asChild variant="secondary">
            <a href="/api/account/export" download>
              <Download aria-hidden /> Download my data
            </a>
          </Button>
        </div>
        <div>
          <p className="font-semibold">Optional wellness information</p>
          <p className="mb-2 text-sm text-muted-foreground">
            {profile.wellness_consent_at
              ? `You gave consent on ${new Date(profile.wellness_consent_at).toLocaleDateString()}. Withdrawing deletes limitation notes and recovery check-ins; sleep entries stay until you delete them under Sleep & Recovery > Goal & privacy.`
              : "You haven't consented to storing optional wellness information."}
          </p>
          {profile.wellness_consent_at && <WithdrawConsentForm />}
        </div>
        <div>
          <p className="font-semibold">AI Coach data sharing</p>
          <p className="mb-2 text-sm text-muted-foreground">
            {profile.ai_data_consent_at
              ? `On since ${new Date(profile.ai_data_consent_at).toLocaleDateString()}. The AI Coach sends your messages and the parts of your log it needs to Anthropic, the AI provider, to answer you.`
              : "Off. The AI Coach (a Pro feature) asks before it sends anything to the AI provider."}
          </p>
          {profile.ai_data_consent_at ? (
            <AiConsentOffForm />
          ) : (
            <Link href="/coach" className="text-sm text-gold-highlight underline-offset-4 hover:underline">
              Review what&apos;s shared on the AI Coach screen
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-semibold text-destructive-foreground">Delete account</p>
          <p className="mb-3 text-sm text-muted-foreground">
            This cancels any subscription bought on this website and permanently deletes your account and data. It can&apos;t be undone.
          </p>
          {storeBilled ? (
            <p role="alert" className="mb-3 rounded-lg border border-[#a8802f]/60 bg-[#a8802f]/10 p-3 text-sm">
              Your {plans[plan].name} subscription is billed by the {storeBilled}. Deleting your account won&apos;t cancel it — cancel it first in your{" "}
              {storeBilled} subscription settings ({storeBilled === "App Store" ? "Settings → your name → Subscriptions" : "Google Play → Payments & subscriptions"}).
            </p>
          ) : null}
          <DeleteAccountForm />
        </div>
      </section>

      <form action={signOutAction}>
        <Button type="submit" variant="secondary" className="w-full">
          <LogOut aria-hidden /> Sign out
        </Button>
      </form>
    </div>
  );
}
