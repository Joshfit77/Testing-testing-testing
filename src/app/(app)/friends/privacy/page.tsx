import { notFound, redirect } from "next/navigation";
import { EyeOff } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { BlockedList, PrivacySwitches, UsernameForm } from "@/components/friends/friends-panels";
import { FRIENDS_NEVER_SHARED, FRIENDS_NOT_SHARED_NOTE } from "@/lib/domain/friends";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { FRIENDS_FLAG, isFlagOn } from "@/server/flags";
import { getFriendsData, getMySocialProfile } from "@/server/services/friends";

export const metadata = { title: "Friends privacy" };

const section = "rounded-2xl border border-border bg-card p-4 md:p-5";

/** What friends can see, my username, and members I blocked (migration 091). */
export default async function FriendsPrivacyPage() {
  const { user } = await requireOnboardedUser();
  if (!(await isFlagOn(FRIENDS_FLAG))) notFound();
  const supabase = await getServerSupabase();
  const me = await getMySocialProfile(supabase, user.id);
  if (!me) redirect("/friends");
  const { overview } = await getFriendsData(supabase, user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader back={{ href: "/friends", label: "Friends" }} title="Privacy & sharing" description="You decide what friends see. Changes take effect straight away." className="mb-2" />

      <section className={section} aria-labelledby="privacy-friends-title">
        <h2 id="privacy-friends-title" className="text-lg font-semibold">
          What friends can see
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Friends always see your username and the name on your profile. Anything else is shared only if you switch it on.</p>
        <PrivacySwitches initial={me.privacy} group="friends" />
        <p className="mt-1 text-sm text-muted-foreground" data-testid="privacy-not-shared">
          {FRIENDS_NOT_SHARED_NOTE}
        </p>
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold">
          <EyeOff className="size-4 text-gold" aria-hidden /> Never shared
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{FRIENDS_NEVER_SHARED.join(" · ")}.</p>
      </section>

      <section className={section} aria-labelledby="privacy-finding-title">
        <h2 id="privacy-finding-title" className="text-lg font-semibold">
          Finding you
        </h2>
        <PrivacySwitches initial={me.privacy} group="finding" />
        <div className="mt-3 border-t border-border pt-4">
          <UsernameForm current={me.username} submitLabel="Change" />
        </div>
      </section>

      <section className={section} aria-labelledby="privacy-blocked-title">
        <h2 id="privacy-blocked-title" className="mb-1 text-lg font-semibold">
          Blocked members
        </h2>
        {overview.blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven&apos;t blocked anyone. You can block or report someone from their profile.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">Blocked members can&apos;t find you or send you requests. They aren&apos;t told.</p>
            <BlockedList blocked={overview.blocked} />
          </>
        )}
      </section>
    </div>
  );
}
