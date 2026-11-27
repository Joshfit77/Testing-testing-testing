import Link from "next/link";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { Button } from "@/components/ui/button";

/** The honest locked state for a screen that a higher plan includes. */
export function PlanLocked({
  back,
  eyebrow,
  title,
  description,
  freeAlternative,
}: {
  back: { href: string; label: string };
  eyebrow?: string;
  title: string;
  description: string;
  /** A free way forward from here (e.g. "Browse free programs"), shown beside "See plans" so the lock isn't a dead end. */
  freeAlternative?: { href: string; label: string };
}) {
  return (
    <div className="space-y-6">
      <BackLink href={back.href}>{back.label}</BackLink>
      <PageHeader eyebrow={eyebrow} title={title} />
      <EmptyState
        icon={Lock}
        title="Included with Pro All Access"
        description={description}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/profile/billing">See plans</Link>
            </Button>
            {freeAlternative && (
              <Button asChild variant="secondary">
                <Link href={freeAlternative.href}>{freeAlternative.label}</Link>
              </Button>
            )}
          </div>
        }
      />
    </div>
  );
}
