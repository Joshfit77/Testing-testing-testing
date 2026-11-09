import Link from "next/link";
import { Award, BellRing, Brain, Camera, ChevronRight, CreditCard, Download, HandHeart, HeartPulse, KeyRound, LayoutGrid, LogOut, MapPin, Moon, ScanLine, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { MainHeader } from "@/components/shell/main-header";
import { DisplaySettings } from "@/components/profile/display-settings";
import { DeleteAccountForm, ProfileForm, WithdrawConsentForm, AiConsentOffForm } from "@/components/profile/profile-forms";
import { Button } from "@/components/ui/button";
import { getPlans } from "@/lib/domain/plans";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { signOutAction } from "@/server/actions/auth";
import { SignOutForm } from "@/components/shell/sign-out-form";
import { LegalLinks } from "@/components/profile/legal-links";
import { legalLinks } from "@/server/services/store-billing";
import { getDashboardData } from "@/server/services/dashboard";

export const metadata = { title: "You" };

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

/** Where each permission or private record is managed today: links only, nothing is set from this list. */
const PRIVACY_LINKS = [
  { href: "/progress/sleep/settings", icon: HeartPulse, title: "Apple Health & sleep", body: "Wellness consent and watch import" },
  { href: "/run/record?kind=run", icon: MapPin, title: "Location (GPS)", body: "Asked when you record a run; change it in phone settings" },
  { href: "/coach/memory", icon: Brain, title: "AI Coach memory", body: "What the coach remembers, and turning it off" },
  { href: "/progress/overview#photos", icon: Camera, title: "Progress photos", body: "Private to you; view or delete them" },
  { href: "/progress/body-scan", icon: ScanLine, title: "Body Scan photos", body: "Consent, scans and deleting them" },
  { href: "/faith/journal", icon: HandHeart, title: "Prayer journal", body: "Private; shared with the coach only per entry" },
  { href: "#privacy", icon: Download, title: "Export or delete my data", body: "Download everything, or delete your account" },
] as const;

/**
 * You: progress, goals, notifications, membership and the account, in one tab. Settings that used to be reached
 * through an avatar in the header are all here, one tap from anywhere.
 */
export default async function ProfilePage() {
  const { user, profile } = await requireOnboardedUser();
  const plan = await getUserPlan(user.id);
  const plans = getPlans();
  const supabase = await getServerSupabase();
  const [{ data: ent }, dashboard] = await Promise.all([
    supabase.from("user_entitlements").select("source").eq("user_id", user.id).maybeSingle(),
    getDashboardData(supabase, user.id, profile.timezone).catch(() => null),
  ]);
  // Account deletion can't cancel an App Store or Google Play subscription (App Store guideline 5.1.1(v)).
  const storeBilled = plan !== "free" && (ent?.source === "app_store" || ent?.source === "play_store") ? (ent.source === "app_store" ? "App Store" : "Google Play") : null;
  const name = profile.display_name ?? "Athlete";
  return (
    <div className="space-y-4">
      <MainHeader title="You" subtitle={<span className="block truncate">{name} · {plans[plan].name} plan · {user.email}</span>} />

      <nav aria-label="Your sections" className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        <Row href="/progress" icon={TrendingUp} title="My Progress" body={dashboard ? `${dashboard.workoutsThisWeek} workout${dashboard.workoutsThisWeek === 1 ? "" : "s"} this week · ${dashboard.weekStreak} week streak · overview, body map, photos` : "Overview, body map, photos and history"} />
        <Row href="/progress/badges" icon={Award} title="Badges" body="Milestones you've earned and what's next" />
        <Row href="/progress/sleep" icon={Moon} title="Sleep & Recovery" body="Nightly reports, sleep debt, schedule and energy" />
        <Row href="/profile/preferences" icon={Target} title="Goals & training preferences" body="Goals, experience, schedule, equipment, diet and body" />
        <Row href="/profile/notifications" icon={BellRing} title="Notifications" body="Reminders for Faith, workouts, food, water and recovery; quiet hours" />
        <Row href="/profile/billing" icon={CreditCard} title="Plans & billing" body={`Current plan: ${plans[plan].name}`} />
        <Row href="/profile/customize" icon={LayoutGrid} title="Customize Home" body="Choose and order what Home and Faith show first" />
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
        <DisplaySettings initial={{ textSize: profile.text_size ?? "default", reduceMotion: profile.reduce_motion ?? false, homeScripture: profile.home_scripture ?? true }} />
      </section>

      <nav aria-labelledby="permissions-title" className="overflow-hidden rounded-2xl border border-border bg-card" data-testid="privacy-permissions">
        <h2 id="permissions-title" className="flex items-center gap-2 px-4 pb-1 pt-4 text-lg font-semibold">
          <ShieldCheck className="size-5 text-gold" aria-hidden /> Privacy &amp; permissions
        </h2>
        <ul className="divide-y divide-border">
          {PRIVACY_LINKS.map(({ href, icon: Icon, title, body }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-elevated/50">
                <Icon className="size-4 shrink-0 text-gold" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-muted-foreground">{body}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section id="privacy" className={`${section} scroll-mt-24 space-y-5`} aria-labelledby="privacy-title">
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
        <LegalLinks legal={legalLinks()} />
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-semibold text-destructive-foreground">Delete account</p>
          <p className="mb-3 text-sm text-muted-foreground">This cancels any subscription bought on this website and permanently deletes your account and data. It can&apos;t be undone.</p>
          {storeBilled ? (
            <p role="alert" className="mb-3 rounded-lg border border-[#a8802f]/60 bg-[#a8802f]/10 p-3 text-sm">
              Your {plans[plan].name} subscription is billed by the {storeBilled}. Deleting your account won&apos;t cancel it — cancel it first in your {storeBilled} subscription settings (
              {storeBilled === "App Store" ? "Settings → your name → Subscriptions" : "Google Play → Payments & subscriptions"}).
            </p>
          ) : null}
          <DeleteAccountForm />
        </div>
      </section>

      <SignOutForm action={signOutAction} userId={user.id}>
        <Button type="submit" variant="secondary" className="w-full">
          <LogOut aria-hidden /> Sign out
        </Button>
      </SignOutForm>
    </div>
  );
}
