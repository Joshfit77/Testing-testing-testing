import { notFound } from "next/navigation";
import { CalendarCheck, EyeOff, Flame } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Avatar } from "@/components/friends/avatar";
import { FriendActions } from "@/components/friends/friends-panels";
import { StatTile } from "@/components/ui/stat-tile";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { FRIENDS_FLAG, isFlagOn } from "@/server/flags";
import { getFriendProfile } from "@/server/services/friends";

export const metadata = { title: "Friend" };

const section = "rounded-2xl border border-border bg-card p-4 md:p-5";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A friend's profile: only what they chose to share (friend_profile, migration 076). 404 for anyone who isn't a friend. */
export default async function FriendProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireOnboardedUser();
  if (!(await isFlagOn(FRIENDS_FLAG))) notFound();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await getServerSupabase();
  const friend = await getFriendProfile(supabase, id);
  if (!friend) notFound();
  const since = new Date(friend.since).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const sharesWorkouts = friend.workoutsLast7Days !== undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader back={{ href: "/friends", label: "Friends" }} title={friend.displayName} className="mb-2" />

      <section className={`${section} flex items-center gap-4`} aria-label="Friend">
        <Avatar name={friend.displayName} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{friend.displayName}</p>
          <p className="truncate text-sm text-muted-foreground">@{friend.username}</p>
          <p className="text-sm text-muted-foreground">Friends since {since}</p>
        </div>
      </section>

      {sharesWorkouts ? (
        <section aria-label="Training" className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="friend-stats">
          <StatTile icon={CalendarCheck} label="Workouts, last 7 days" value={friend.workoutsLast7Days} />
          {friend.streakDays !== undefined && friend.streakWeeks !== undefined && (
            <StatTile icon={Flame} label="Streak" value={`${plural(friend.streakDays, "day", "days")} · ${plural(friend.streakWeeks, "week", "weeks")}`} tone="gold" />
          )}
        </section>
      ) : (
        <section className={section} data-testid="friend-private">
          <p className="flex items-center gap-2 font-semibold">
            <EyeOff className="size-5 text-gold" aria-hidden /> {friend.displayName} keeps their training private
          </p>
          <p className="mt-1 text-sm text-muted-foreground">You can still be friends. Everyone chooses what to share.</p>
        </section>
      )}

      <section className={section} aria-labelledby="friend-manage-title">
        <h2 id="friend-manage-title" className="mb-3 text-lg font-semibold">
          Manage
        </h2>
        <FriendActions userId={friend.userId} name={friend.displayName} />
      </section>
    </div>
  );
}
