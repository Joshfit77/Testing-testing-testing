import { ChevronRight, FileText } from "lucide-react";

/**
 * The Privacy Policy, Terms and notices, reachable from Profile at any time (App Store guideline 5.1.1(i): the
 * policy must be easy to find inside the app, not only at sign-up or on the paywall).
 */
export function LegalLinks({ legal }: { legal: { termsUrl: string; privacyUrl: string; final: boolean } }) {
  const links = [
    { href: legal.privacyUrl, label: "Privacy Policy" },
    { href: legal.termsUrl, label: "Terms of Service" },
    { href: "/legal/notices", label: "Notices & licenses" },
  ];
  return (
    <div>
      <p className="font-semibold">Legal</p>
      {!legal.final && <p className="mb-2 text-sm text-muted-foreground">Drafts awaiting legal review.</p>}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm hover:bg-elevated/50">
              <FileText className="size-4 shrink-0 text-gold" aria-hidden />
              <span className="flex-1">{l.label}</span>
              <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
