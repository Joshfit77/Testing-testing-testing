import { notFound } from "next/navigation";
import { EyeOff, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EnterCodeForm, InviteCodes, PartnerCard } from "@/components/accountability/accountability-panels";
import { MAX_PARTNERS, NEVER_SHARED, SHARE_OPTIONS } from "@/lib/domain/accountability";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { ACCOUNTABILITY_FLAG, isFlagOn } from "@/server/flags";
import { getAccountabilityData } from "@/server/services/accountability";

export const metadata = { title: "Accountability partners" };

const section = "rounded-2xl border border-border bg-card p-4 md:p-5";

/**
 * Accountability partners (migration 067). Off unless the owner has switched on the `accountability_partners` flag:
 * until then this page doesn't exist (404) and nothing links to it.
 */
export default async function AccountabilityPage() {
  const { user } = await requireOnboardedUser();
  if (!(await isFlagOn(ACCOUNTABILITY_FLAG))) notFound();
  const supabase = await getServerSupabase();
  const { partners, invites } = await getAccountabilityData(supabase, user.id);
  const full = partners.length >= MAX_PARTNERS;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        back={{ href: "/profile", label: "You" }}
        title="Accountability partners"
        description={`Invite up to ${MAX_PARTNERS} friends to cheer each other on. You choose what each partner sees, and either of you can end it at any time.`}
        className="mb-2"
      />

      <section className={section} aria-labelledby="acc-privacy-title" data-testid="accountability-privacy">
        <h2 id="acc-privacy-title" className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-5 text-gold" aria-hidden /> What a partner can see
        </h2>
        <p className="mb-2 text-sm text-muted-foreground">Only the items you switch on for that partner, as simple numbers:</p>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-sm">
          {SHARE_OPTIONS.map((o) => (
            <li key={o.key}>
              <span className="font-semibold">{o.label}</span> <span className="text-muted-foreground">({o.key === "share_program_progress" ? "off unless you turn it on" : "on unless you turn it off"})</span>
            </li>
          ))}
          <li>
            <span className="font-semibold">Your display name</span> <span className="text-muted-foreground">(so they know who you are; never your email)</span>
          </li>
        </ul>
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <EyeOff className="size-4 text-gold" aria-hidden /> Never shared
        </p>
        <p className="text-sm text-muted-foreground">{NEVER_SHARED.join(" · ")}.</p>
      </section>

      <section className={section} aria-labelledby="acc-partners-title">
        <h2 id="acc-partners-title" className="mb-3 text-lg font-semibold">
          Your partners {partners.length > 0 && <span className="text-sm font-normal text-muted-foreground">({partners.length} of {MAX_PARTNERS})</span>}
        </h2>
        {partners.length === 0 ? (
          <p className="text-sm text-muted-foreground">No partners yet. Share a code below, or enter a friend&apos;s code.</p>
        ) : (
          <ul className="space-y-3" data-testid="accountability-partners">
            {partners.map((p) => (
              <li key={p.id}>
                <PartnerCard partner={p} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={section} aria-labelledby="acc-invite-title">
        <h2 id="acc-invite-title" className="mb-1 text-lg font-semibold">
          Invite a friend
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">Each code works once and expires after 7 days. The code itself shares nothing about you.</p>
        <InviteCodes invites={invites} full={full} />
      </section>

      <section className={section} aria-labelledby="acc-code-title">
        <h2 id="acc-code-title" className="mb-1 text-lg font-semibold">
          Have a code?
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">Entering a friend&apos;s code makes you partners. You&apos;ll both start sharing workouts this week and streak; change that any time below each partner.</p>
        <EnterCodeForm disabled={full} />
      </section>
    </div>
  );
}
