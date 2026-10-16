import Link from "next/link";
import { Logo } from "@/components/common/logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      <Link href="/" aria-label="Narrow Gate Fitness home">
        <Logo />
      </Link>
      <div className="mt-6 rounded-xl border border-[#a8802f]/60 bg-[#a8802f]/10 px-4 py-3 text-sm" role="note">
        <strong className="text-gold-highlight">Placeholder — requires legal review.</strong> This document is a draft outline and is not
        legally binding. Have qualified counsel review and complete it before launch.
      </div>
      <article className="prose-ngf mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:uppercase [&_h1]:text-foreground [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </article>
    </div>
  );
}
