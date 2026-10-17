import { redirect } from "next/navigation";
import { Logo } from "@/components/common/logo";
import { SetupRequired } from "@/components/common/setup-required";
import { OnboardingQuestionnaire } from "@/components/onboarding/onboarding-questionnaire";
import { isSupabaseConfigured } from "@/lib/env";
import { getProfile, requireUser } from "@/server/auth";

export const metadata = { title: "Get started" };

export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) return <SetupRequired />;
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (profile?.onboarding_completed_at) redirect("/home");

  return (
    <div className="hero-glow min-h-dvh">
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <Logo />
        <h1 className="mt-8 font-display text-4xl font-bold uppercase">Let&apos;s build your plan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          About a dozen quick questions. We&apos;ll use them to build your first training program and a daily calorie budget. You can change any answer later.
        </p>
        <div className="mt-8">
          <OnboardingQuestionnaire initialName={profile?.display_name ?? ""} />
        </div>
      </div>
    </div>
  );
}
