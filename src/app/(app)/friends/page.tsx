import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ShieldCheck, UserPlus, Users } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/common/page-header";
import { Avatar } from "@/components/friends/avatar";
import { FriendSearch, IncomingRequests, InviteLinks, OutgoingRequests, UsernameForm } from "@/components/friends/friends-panels";
import { FRIENDS_NEVER_SHARED, FRIENDS_NOT_SHARED_NOTE, MAX_FRIENDS } from "@/lib/domain/friends";
import { publicEnv } from "@/lib/env";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { FRIENDS_FLAG, isFlagOn } from "@/server/flags";
import { getFriendsData, getMySocialProfile } from "@/server/services/friends";

export const metadata = { title: "Friends" };

const section = "rounded-2xl border border-border bg-card p-4 md:p-5";
const h2 = "mb-3 text-lg font-semibold";

/**
 * Friends (migration 076). Off unless the owner has switched on the `friends_challenges` flag: until then this page
 * doesn't exist (404) and nothing links to it.
 */
export default async function FriendsPage() {
  const { user } = await requireOnboardedUser();
  if (!(await isFlagOn(FRIENDS_FLAG))) notFound();
  const supabase = await getServerSupabase();
  const me = await getMySocialProfile(supabase, user.id);

  if (!me) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader back={{ href: "/profile", label: "You" }} title="Friends" description="Train alongside people you know. Add friends, cheer each other on and keep each other consistent." className="mb-2" />
        <section className={section} aria-labelledby="friends-start-title" data-testid="friends-start">
          <h2 id="friends-start-title" className="mb-1 text-lg font-semibold">
            Choose your username
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">This is how friends find you. Nothing is shared with anyone until you become friends. A friend then sees your username and the name on your profile, and nothing else unless you switch it on.</p>
          <UsernameForm submitLabel="Get started" />
        </section>
        <section className={section} aria-labelledby="friends-private-title">
          <h2 id="friends-private-title" className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="size-5 text-gold" aria-hidden /> Private by default
          </h2>
          <p className="mb-2 text-sm text-muted-foreground">Your workout count and streaks stay private until you switch them on in Privacy &amp; sharing. {FRIENDS_NOT_SHARED_NOTE} These are never shared either:</p>
          <p className="text-sm text-muted-foreground">{FRIENDS_NEVER_SHARED.join(" · ")}.</p>
        </section>
      </div>
    );
  }

  const { overview, invites } = await getFriendsData(supabase, user.id);
  const { friends, incoming, outgoing } = overview;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader back={{ href: "/profile", label: "You" }} title="Friends" description={`You're @${me.username}. Add friends, cheer each other on and keep each other consistent.`} className="mb-2" />

      {incoming.length > 0 && (
        <section className={section} aria-labelledby="friends-incoming-title">
          <h2 id="friends-incoming-title" className={h2}>
            Friend requests <span className="text-sm font-normal text-muted-foreground">({incoming.length})</span>
          </h2>
          <IncomingRequests requests={incoming} />
        </section>
      )}

      <section className={section} aria-labelledby="friends-list-title">
        <h2 id="friends-list-title" className={h2}>
          Your friends {friends.length > 0 && <span className="text-sm font-normal text-muted-foreground">({friends.length})</span>}
        </h2>
        {friends.length === 0 ? (
          <EmptyState icon={Users} title="No friends yet" description="Search for a friend's username below, or send them an invite link." className="border-0 bg-transparent py-6" />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border" data-testid="friends-list">
            {friends.map((f) => (
              <li key={f.userId}>
                <Link href={`/friends/${f.userId}`} className="flex min-h-14 items-center gap-3 bg-elevated/40 px-3 py-2 hover:bg-elevated">
                  <Avatar name={f.displayName} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{f.displayName}</span>
                    <span className="block truncate text-sm text-muted-foreground">@{f.username}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {friends.length >= MAX_FRIENDS && <p className="mt-2 text-sm text-muted-foreground">You have the most friends you can ({MAX_FRIENDS}).</p>}
      </section>

      <section className={section} aria-labelledby="friends-add-title">
        <h2 id="friends-add-title" className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <UserPlus className="size-5 text-gold" aria-hidden /> Add a friend
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">Search for their username. They choose whether to accept.</p>
        <FriendSearch />
        <h3 className="mb-1 mt-5 font-semibold">Not on Narrow Gate Fitness yet?</h3>
        <p className="mb-3 text-sm text-muted-foreground">Send an invite link. Whoever opens it and signs in becomes your friend. Each link works once and expires after 7 days.</p>
        <InviteLinks invites={invites} siteUrl={publicEnv.siteUrl} />
      </section>

      {outgoing.length > 0 && (
        <section className={section} aria-labelledby="friends-outgoing-title">
          <h2 id="friends-outgoing-title" className={h2}>
            Requests you sent
          </h2>
          <OutgoingRequests requests={outgoing} />
        </section>
      )}

      <nav aria-label="Friends settings" className="overflow-hidden rounded-2xl border border-border bg-card">
        <Link href="/friends/privacy" className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-elevated/50">
          <ShieldCheck className="size-5 shrink-0 text-gold" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Privacy &amp; sharing</span>
            <span className="block text-sm text-muted-foreground">What friends can see, your username and blocked members</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
        </Link>
      </nav>
    </div>
  );
}
