/** Banner for legal documents that have not been reviewed and completed by counsel. */
export function LegalReviewNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#a8802f]/60 bg-[#a8802f]/10 px-4 py-3 text-sm text-foreground" role="note">
      <strong className="text-gold-highlight">Placeholder — requires legal review.</strong> {children}
    </div>
  );
}
