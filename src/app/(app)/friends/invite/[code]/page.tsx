import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { AcceptInvite } from "@/components/friends/friends-panels";
import { normalizeInviteCode } from "@/lib/domain/friends";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { FRIENDS_FLAG, isFlagOn } from "@/server/flags";
import { getMySocialProfile } from "@/server/services/friends";

export const metadata = { title: "Friend invite" };

/**
 * Where an invite link lands (migration 076). A signed-out visitor is sent to sign in first and comes back here. The
 * code is only checked when the member taps Accept, so opening the link reveals nothing about who sent it.
 */
export default async function FriendInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { user } = await requireOnboardedUser();
  if (!(await isFlagOn(FRIENDS_FLAG))) notFound();
  const code = normalizeInviteCode((await params).code);
  const supabase = await getServerSupabase();
  const me = await getMySocialProfile(supabase, user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader back={{ href: "/friends", label: "Friends" }} title="You're invited" description="A friend sent you this link so you can train alongside each other." className="mb-2" />
      <section className="rounded-2xl border border-border bg-card p-4 md:p-5" data-testid="friend-invite">
        {code ? (
          <>
            <p className="mb-3 text-sm text-muted-foreground">Accepting makes you friends. You each choose what the other sees, and either of you can remove the other at any time.</p>
            <AcceptInvite code={code} hasUsername={Boolean(me)} />
          </>
        ) : (
          <Notice tone="warning">This invite link isn&apos;t complete. Ask your friend to send it again.</Notice>
        )}
      </section>
    </div>
  );
}
