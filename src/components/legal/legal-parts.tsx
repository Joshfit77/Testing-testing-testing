import { LegalReviewNotice } from "@/components/legal/review-notice";

export const legalLinkClass = "text-gold-highlight underline";

/** Formats a YYYY-MM-DD date as e.g. "December 1, 2026". */
export function formatLegalDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/** Draft banner listing the details still required before a legal document can be published. */
export function UnpublishedNotice({ missing }: { missing: string[] }) {
  return (
    <LegalReviewNotice>
      This document has not been published. Before publication, the following must be supplied:
      <ul className="mt-2">
        {missing.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </LegalReviewNotice>
  );
}

export function EffectiveDate({ date }: { date: string | null }) {
  return (
    <p>
      {date ? (
        <>
          Effective date: <time dateTime={date}>{formatLegalDate(date)}</time>
        </>
      ) : (
        "Effective date: not yet set — this document has not been published."
      )}
    </p>
  );
}

export function ContactDetails({ name, email, address }: { name: string | null; email: string | null; address: string | null }) {
  if (!name && !email && !address) return <p>Contact details will be listed here when this document is published.</p>;
  return (
    <address className="not-italic">
      {name && <span className="block text-foreground">{name}</span>}
      {address && <span className="block whitespace-pre-line">{address}</span>}
      {email && (
        <a href={`mailto:${email}`} className={legalLinkClass}>
          {email}
        </a>
      )}
    </address>
  );
}

export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={legalLinkClass} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
