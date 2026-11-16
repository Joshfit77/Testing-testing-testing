"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Check, Flag, Search, Share2, ShieldBan, UserMinus, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/friends/avatar";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import {
  friendInviteShareText,
  inviteUrl,
  MAX_OPEN_FRIEND_INVITES,
  normalizeUsername,
  PRIVACY_OPTIONS,
  REPORT_DETAILS_MAX,
  REPORT_REASON_KEYS,
  REPORT_REASONS,
  SEARCH_MIN_CHARS,
  USERNAME_MAX,
  usernameProblem,
  type BlockedEntry,
  type PrivacyKey,
  type PrivacySettings,
  type ReportReason,
  type RequestEntry,
  type SearchHit,
} from "@/lib/domain/friends";
import {
  acceptFriendInviteAction,
  blockUserAction,
  cancelFriendRequestAction,
  claimUsernameAction,
  createFriendInviteAction,
  removeFriendAction,
  reportUserAction,
  respondFriendRequestAction,
  searchUsersAction,
  sendFriendRequestAction,
  unblockUserAction,
  updatePrivacyAction,
  withdrawFriendInviteAction,
} from "@/server/actions/friends";
import type { OpenFriendInvite } from "@/server/services/friends";

async function shareOrCopy(text: string): Promise<void> {
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success("Invite copied.");
  } catch (e) {
    // Closing the share sheet isn't an error.
    if ((e as { name?: string })?.name === "AbortError") return;
    toast.error("Couldn't share from this device. Select the link and copy it.");
  }
}

const dateFmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Choose (or change) a username. `onDone` runs after it is saved; by default the screen refreshes. */
export function UsernameForm({ current, submitLabel = "Save username", onDone }: { current?: string; submitLabel?: string; onDone?: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const name = normalizeUsername(value);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const problem = usernameProblem(value);
        if (problem) return void setError(problem);
        setError(null);
        start(async () => {
          const r = await claimUsernameAction(value);
          if (!r.ok) return void setError(r.error);
          toast.success(`You're @${r.username}.`);
          if (onDone) onDone();
          else router.refresh();
        });
      }}
    >
      <label htmlFor="friends-username" className="text-sm font-semibold">
        Username
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden>
            @
          </span>
          <Input
            id="friends-username"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\s/g, ""))}
            placeholder="yourname"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={USERNAME_MAX + 1}
            disabled={pending}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "friends-username-error" : "friends-username-hint"}
            className="pl-8"
          />
        </div>
        <Button type="submit" disabled={pending || !name || name === current}>
          {submitLabel}
        </Button>
      </div>
      {error ? (
        <p id="friends-username-error" role="alert" className="text-sm text-destructive-foreground">
          {error}
        </p>
      ) : (
        <p id="friends-username-hint" className="text-sm text-muted-foreground">
          3 to 20 letters, numbers or underscores. Friends find you by this name; it can be changed once every 30 days.
        </p>
      )}
    </form>
  );
}

/** Find members by username and send a request. Shows usernames only. */
export function FriendSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const latest = useRef(0);

  const search = () => {
    const q = normalizeUsername(query);
    if (q.length < SEARCH_MIN_CHARS) return void setError(`Type at least ${SEARCH_MIN_CHARS} characters of their username.`);
    setError(null);
    const turn = ++latest.current;
    start(async () => {
      const r = await searchUsersAction(q);
      if (turn !== latest.current) return;
      if (!r.ok) return void setError(r.error);
      setHits(r.hits);
    });
  };

  const request = (hit: SearchHit) =>
    start(async () => {
      const r = await sendFriendRequestAction(hit.userId);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.status === "accepted" ? `You and @${hit.username} are friends now.` : `Request sent to @${hit.username}.`);
      setHits((prev) => prev?.map((h) => (h.userId === hit.userId ? { ...h, relation: r.status === "accepted" ? "friend" : "requested" } : h)) ?? null);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <label htmlFor="friends-search" className="sr-only">
          Search by username
        </label>
        <Input
          id="friends-search"
          value={query}
          onChange={(e) => setQuery(e.target.value.replace(/\s/g, ""))}
          placeholder="Search by username"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={USERNAME_MAX + 1}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "friends-search-error" : undefined}
        />
        <Button type="submit" variant="secondary" disabled={pending} aria-label="Search">
          <Search aria-hidden /> <span className="hidden sm:inline">Search</span>
        </Button>
      </form>
      {error && (
        <p id="friends-search-error" role="alert" className="text-sm text-destructive-foreground">
          {error}
        </p>
      )}
      {hits && (
        <div aria-live="polite">
          {hits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No member found with that username. Check the spelling, or send them an invite link.</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border" data-testid="friend-search-results">
              {hits.map((h) => (
                <li key={h.userId} className="flex min-h-14 items-center gap-3 bg-elevated/40 px-3 py-2">
                  <Avatar name={h.username} />
                  <span className="min-w-0 flex-1 truncate font-semibold">@{h.username}</span>
                  {h.relation === "friend" ? (
                    <span className="flex items-center gap-1 text-sm text-success-foreground">
                      <Check className="size-4" aria-hidden /> Friends
                    </span>
                  ) : h.relation === "requested" ? (
                    <span className="text-sm text-muted-foreground">Request sent</span>
                  ) : (
                    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => request(h)}>
                      <UserPlus aria-hidden /> {h.relation === "incoming" ? "Accept" : "Add"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Requests sent to me: accept or decline. */
export function IncomingRequests({ requests }: { requests: RequestEntry[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const respond = (r: RequestEntry, accept: boolean) =>
    start(async () => {
      const res = await respondFriendRequestAction(r.requestId, accept);
      if (!res.ok) toast.error(res.error);
      else if (accept) toast.success(`You and @${r.username} are friends now.`);
      router.refresh();
    });
  return (
    <ul className="space-y-2" data-testid="friend-requests-incoming">
      {requests.map((r) => (
        <li key={r.requestId} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-elevated/40 p-3">
          <Avatar name={r.username} />
          <span className="min-w-[9rem] flex-1">
            <span className="block truncate font-semibold">@{r.username}</span>
            <span className="block text-xs text-muted-foreground">Sent {dateFmt(r.at)}</span>
          </span>
          <span className="flex w-full gap-2 sm:w-auto">
            <Button type="button" size="sm" disabled={pending} onClick={() => respond(r, true)}>
              <Check aria-hidden /> Accept
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => respond(r, false)}>
              Decline
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Requests I sent that haven't been answered: withdraw. */
export function OutgoingRequests({ requests }: { requests: RequestEntry[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ul className="space-y-2" data-testid="friend-requests-outgoing">
      {requests.map((r) => (
        <li key={r.requestId} className="flex items-center gap-3 rounded-xl border border-border bg-elevated/40 p-3">
          <Avatar name={r.username} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">@{r.username}</span>
            <span className="block text-xs text-muted-foreground">Waiting since {dateFmt(r.at)}</span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await cancelFriendRequestAction(r.requestId);
                if (!res.ok) toast.error(res.error);
                router.refresh();
              })
            }
          >
            Withdraw
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** My open invite links, with share and withdraw, and a button for a new one. */
export function InviteLinks({ invites, siteUrl }: { invites: OpenFriendInvite[]; siteUrl: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const create = () =>
    start(async () => {
      const r = await createFriendInviteAction();
      if (!r.ok) return void toast.error(r.error);
      // Not shared automatically (the share sheet needs a fresh tap): the new link appears with its Share button.
      toast.success("Invite link created. Tap Share to send it.");
      router.refresh();
    });
  return (
    <div className="space-y-3">
      {invites.length > 0 && (
        <ul className="space-y-2" data-testid="friend-invites">
          {invites.map((i) => {
            const url = inviteUrl(siteUrl, i.code);
            return (
              <li key={i.id} className="rounded-xl border border-border bg-elevated/40 p-3">
                <p className="break-all font-mono text-sm text-gold-highlight select-all">{url}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">One use · expires {dateFmt(i.expiresAt)}</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => shareOrCopy(friendInviteShareText(url, i.expiresAt))}>
                      <Share2 aria-hidden /> Share
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await withdrawFriendInviteAction(i.id);
                          if (!r.ok) toast.error(r.error);
                          router.refresh();
                        })
                      }
                    >
                      Withdraw
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {invites.length >= MAX_OPEN_FRIEND_INVITES ? (
        <p className="text-sm text-muted-foreground">You have {MAX_OPEN_FRIEND_INVITES} unused links. Withdraw one to make another.</p>
      ) : (
        <Button type="button" variant={invites.length ? "secondary" : "default"} onClick={create} disabled={pending} className="w-full sm:w-auto" data-testid="friend-invite-create">
          <UserPlus aria-hidden /> {invites.length ? "Create another link" : "Invite a friend"}
        </Button>
      )}
    </div>
  );
}

/** The privacy switches. Each takes effect at once. */
export function PrivacySwitches({ initial, group }: { initial: PrivacySettings; group: "finding" | "friends" }) {
  const [settings, setSettings] = useState<PrivacySettings>(initial);
  const [, start] = useTransition();
  const toggle = (key: PrivacyKey, value: boolean) => {
    const prev = settings;
    setSettings({ ...settings, [key]: value });
    start(async () => {
      const r = await updatePrivacyAction({ key, value });
      if (!r.ok) {
        setSettings(prev);
        toast.error(r.error);
      }
    });
  };
  const profileOff = !settings.profile_visible;
  return (
    <ul className="divide-y divide-border">
      {PRIVACY_OPTIONS.filter((o) => o.group === group).map((o) => {
        // With the profile hidden, the items under it have no effect: shown as off and locked.
        const locked = group === "friends" && profileOff && o.key !== "profile_visible" && o.key !== "show_in_leaderboards";
        return (
          <li key={o.key} className="flex items-start justify-between gap-4 py-3">
            <span className="min-w-0">
              <span id={`privacy-${o.key}`} className="block font-semibold">
                {o.label}
              </span>
              <span className="block text-sm text-muted-foreground">{locked ? "Hidden while your profile is hidden." : o.detail}</span>
            </span>
            <Switch checked={settings[o.key] && !locked} disabled={locked} onCheckedChange={(v) => toggle(o.key, v)} aria-labelledby={`privacy-${o.key}`} data-testid={`privacy-${o.key}`} />
          </li>
        );
      })}
    </ul>
  );
}

/** Members I blocked, with unblock. */
export function BlockedList({ blocked }: { blocked: BlockedEntry[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ul className="space-y-2" data-testid="friends-blocked">
      {blocked.map((b) => (
        <li key={b.userId} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/40 p-3">
          <span className="min-w-0 truncate font-semibold">{b.username ? `@${b.username}` : "A member"}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await unblockUserAction(b.userId);
                if (!r.ok) toast.error(r.error);
                router.refresh();
              })
            }
          >
            Unblock
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** On a friend's profile: remove, block or report. */
export function FriendActions({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    const ok = await confirmDialog({
      title: `Remove ${name} as a friend?`,
      message: "You'll both stop seeing each other's profile straight away. They aren't told. You can send a new request later.",
      confirmLabel: "Remove friend",
      destructive: true,
    });
    if (!ok) return;
    start(async () => {
      const r = await removeFriendAction(userId);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Friend removed.");
      router.push("/friends");
      router.refresh();
    });
  };

  const block = async () => {
    const ok = await confirmDialog({
      title: `Block ${name}?`,
      message: "They are removed from your friends, can't find you or send you requests, and any accountability partnership between you ends. They aren't told. You can unblock them in Privacy & sharing.",
      confirmLabel: "Block",
      destructive: true,
    });
    if (!ok) return;
    start(async () => {
      const r = await blockUserAction(userId);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Blocked.");
      router.push("/friends");
      router.refresh();
    });
  };

  const sendReport = () => {
    if (!reason) return void setError("Choose a reason.");
    setError(null);
    start(async () => {
      const r = await reportUserAction({ userId, reason, details: details.trim() || undefined, block: alsoBlock });
      if (!r.ok) return void setError(r.error);
      setReporting(false);
      toast.success("Report sent. Thank you.");
      if (alsoBlock) router.push("/friends");
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2" aria-busy={pending}>
        <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={remove}>
          <UserMinus aria-hidden /> Remove friend
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={block}>
          <ShieldBan aria-hidden /> Block
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setReporting(true)}>
          <Flag aria-hidden /> Report
        </Button>
      </div>

      <Dialog open={reporting} onOpenChange={setReporting}>
        <DialogContent side="bottom">
          <DialogHeader>
            <DialogTitle>Report {name}</DialogTitle>
            <DialogDescription>Reports go to the Narrow Gate Fitness team, not to {name}.</DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-semibold">What&apos;s wrong?</legend>
            {REPORT_REASON_KEYS.map((k) => (
              <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-elevated/40 px-3">
                <input type="radio" name="report-reason" value={k} checked={reason === k} onChange={() => setReason(k)} className="size-4 accent-gold" />
                <span>{REPORT_REASONS[k]}</span>
              </label>
            ))}
          </fieldset>
          <label htmlFor="report-details" className="mt-3 block text-sm font-semibold">
            Anything we should know? <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={REPORT_DETAILS_MAX} className="mt-1" />
          <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-between gap-3">
            <span id="report-block-label" className="font-semibold">
              Also block {name}
            </span>
            <Switch checked={alsoBlock} onCheckedChange={setAlsoBlock} aria-labelledby="report-block-label" />
          </label>
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive-foreground">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="destructive" disabled={pending} onClick={sendReport}>
              Send report
            </Button>
            <Button type="button" variant="ghost" onClick={() => setReporting(false)}>
              <X aria-hidden /> Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Opened from an invite link: choose a username if needed, then become friends. */
export function AcceptInvite({ code, hasUsername }: { code: string; hasUsername: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(hasUsername);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const accept = () => {
    setError(null);
    start(async () => {
      const r = await acceptFriendInviteAction(code);
      if (!r.ok) return void setError(r.error);
      setDone(r.friendId);
      toast.success("You're friends now.");
      router.refresh();
    });
  };

  if (done) {
    return (
      <div className="space-y-3">
        <p className="font-semibold text-success-foreground">You&apos;re friends now.</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/friends/${done}`}>See their profile</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/friends">All friends</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">First choose the username your friends will see.</p>
        <UsernameForm submitLabel="Continue" onDone={() => setReady(true)} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Button type="button" onClick={accept} disabled={pending} data-testid="friend-invite-accept">
        <UserPlus aria-hidden /> Accept invite
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
