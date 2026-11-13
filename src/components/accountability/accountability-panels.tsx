"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Send, Share2, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import {
  formatInviteCode,
  inviteShareText,
  NUDGE_KEYS,
  NUDGE_MESSAGES,
  NUDGES_PER_DAY,
  SHARE_OPTIONS,
  summaryLines,
  type ShareKey,
  type ShareSettings,
} from "@/lib/domain/accountability";
import {
  acceptInviteAction,
  createInviteAction,
  endPartnershipAction,
  sendNudgeAction,
  updateShareAction,
  withdrawInviteAction,
} from "@/server/actions/accountability";
import type { OpenInvite, PartnerView } from "@/server/services/accountability";

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
    toast.error("Couldn't share from this device. Select the code and copy it.");
  }
}

const dateFmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** My open invite codes, with share and withdraw, and a button for a new one. */
export function InviteCodes({ invites, full }: { invites: OpenInvite[]; full: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const r = await createInviteAction();
      if (!r.ok) return void toast.error(r.error);
      // Not shared automatically (the share sheet needs a fresh tap): the new code appears with its Share button.
      toast.success(`Code ${formatInviteCode(r.code)} created. Tap Share to send it.`);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      {invites.length > 0 && (
        <ul className="space-y-2" data-testid="accountability-invites">
          {invites.map((i) => (
            <li key={i.id} className="rounded-xl border border-border bg-elevated/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-xl font-bold tracking-widest text-gold-highlight select-all" aria-label={`Invite code ${i.code.split("").join(" ")}`}>
                    {formatInviteCode(i.code)}
                  </p>
                  <p className="text-xs text-muted-foreground">One use · expires {dateFmt(i.expiresAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => shareOrCopy(inviteShareText(i.code, i.expiresAt))}>
                    <Share2 aria-hidden /> Share
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await withdrawInviteAction(i.id);
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
          ))}
        </ul>
      )}
      {full ? (
        <p className="text-sm text-muted-foreground">You have the most partners you can (3). End a partnership to invite someone new.</p>
      ) : (
        <Button type="button" onClick={create} disabled={pending} className="w-full sm:w-auto">
          <UserPlus aria-hidden /> {invites.length ? "Create another code" : "Create an invite code"}
        </Button>
      )}
    </div>
  );
}

/** Enter a friend's code to become partners. */
export function EnterCodeForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await acceptInviteAction(code);
          if (!r.ok) return void setError(r.error);
          setCode("");
          toast.success("You're partners now.");
          router.refresh();
        });
      }}
    >
      <label htmlFor="acc-code" className="text-sm font-semibold">
        Friend&apos;s code
      </label>
      <div className="flex gap-2">
        <Input
          id="acc-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCDE-FGH23"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={16}
          disabled={disabled || pending}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "acc-code-error" : undefined}
          className="font-mono tracking-widest"
        />
        <Button type="submit" disabled={disabled || pending || code.trim().length < 10}>
          Add
        </Button>
      </div>
      {error && (
        <p id="acc-code-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {disabled && <p className="text-sm text-muted-foreground">You have 3 partners already.</p>}
    </form>
  );
}

/** One partner: what they share with me, what I share with them, encouragements, and ending the partnership. */
export function PartnerCard({ partner }: { partner: PartnerView }) {
  const router = useRouter();
  const [shares, setShares] = useState<ShareSettings>(partner.myShares);
  const [showNudges, setShowNudges] = useState(false);
  const [pending, start] = useTransition();
  const name = partner.summary.partnerName;
  const lines = summaryLines(partner.summary);

  const toggle = (key: ShareKey, value: boolean) => {
    const prev = shares;
    setShares({ ...shares, [key]: value });
    start(async () => {
      const r = await updateShareAction({ partnershipId: partner.id, key, value });
      if (!r.ok) {
        setShares(prev);
        toast.error(r.error);
      }
    });
  };

  const end = async () => {
    const ok = await confirmDialog({
      title: `End partnership with ${name}?`,
      message: "You'll both stop seeing each other's summary straight away, and encouragements between you are deleted. You can partner again later with a new code.",
      confirmLabel: "End partnership",
      destructive: true,
    });
    if (!ok) return;
    start(async () => {
      const r = await endPartnershipAction(partner.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Partnership ended.");
      router.refresh();
    });
  };

  const nudge = (key: string) =>
    start(async () => {
      const r = await sendNudgeAction(partner.id, key);
      if (!r.ok) return void toast.error(r.error);
      setShowNudges(false);
      toast.success(`Sent to ${name}.`);
      router.refresh();
    });

  return (
    <article className="rounded-xl border border-border bg-elevated/40 p-3" aria-label={`Partner ${name}`} aria-busy={pending}>
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="truncate font-semibold">{name}</h3>
        <span className="shrink-0 text-xs text-muted-foreground">Partners since {dateFmt(partner.since)}</span>
      </header>

      {lines.length ? (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="partner-summary">
          {lines.map((l) => (
            <div key={l.label} className="rounded-lg bg-card px-3 py-2">
              <dt className="text-xs text-muted-foreground">{l.label}</dt>
              <dd className="font-semibold">{l.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">{name} isn&apos;t sharing anything with you right now.</p>
      )}

      {partner.received.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">From {name}</p>
          <ul className="space-y-1">
            {partner.received.slice(0, 3).map((n) => (
              <li key={n.id} className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-sm">
                {NUDGE_MESSAGES[n.key]} <span className="text-xs text-muted-foreground">· {dateFmt(n.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <Button type="button" size="sm" variant="outline" disabled={pending || partner.nudgesLeft === 0} onClick={() => setShowNudges((v) => !v)} aria-expanded={showNudges}>
          <Send aria-hidden /> Encourage {name}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">
          {partner.nudgesLeft === 0 ? `You've sent ${NUDGES_PER_DAY} in the last 24 hours.` : `${partner.nudgesLeft} of ${NUDGES_PER_DAY} left today.`}
        </p>
        {showNudges && (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {NUDGE_KEYS.map((k) => (
              <li key={k}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => nudge(k)}
                  className="min-h-11 w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-sm hover:border-gold-muted disabled:opacity-50"
                >
                  {NUDGE_MESSAGES[k]}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <fieldset className="mt-4 space-y-3 border-t border-border pt-3">
        <legend className="sr-only">What I share with {name}</legend>
        <p className="text-sm font-semibold">What I share with {name}</p>
        {SHARE_OPTIONS.map((o) => {
          const id = `share-${partner.id}-${o.key}`;
          return (
            <div key={o.key} className="flex items-start justify-between gap-4">
              <div>
                <p id={id} className="text-[0.9375rem] font-semibold">
                  {o.label}
                </p>
                <p className="text-sm text-muted-foreground">{o.detail}</p>
              </div>
              <Switch checked={shares[o.key]} aria-labelledby={id} disabled={pending} onCheckedChange={(v) => toggle(o.key, v)} />
            </div>
          );
        })}
      </fieldset>

      <div className="mt-4 border-t border-border pt-3">
        <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={pending} onClick={end}>
          <UserMinus aria-hidden /> End partnership
        </Button>
      </div>
    </article>
  );
}
