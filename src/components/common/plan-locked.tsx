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
  plan,
  description,
}: {
  back: { href: string; label: string };
  eyebrow?: string;
  title: string;
  /** Kept for callers; every paid feature is now part of Pro All Access. */
  plan?: "Plus" | "Pro";
  description: string;
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
          <Button asChild>
            <Link href="/profile/billing">See plans</Link>
          </Button>
        }
      />
    </div>
  );
}
