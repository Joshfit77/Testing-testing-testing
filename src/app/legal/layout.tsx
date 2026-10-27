import Link from "next/link";
import { Logo } from "@/components/common/logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      <Link href="/" aria-label="Narrow Gate Fitness home">
        <Logo />
      </Link>
      <article className="prose-ngf mt-6 space-y-4 break-words text-sm leading-relaxed text-muted-foreground [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:uppercase [&_h1]:text-foreground [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_strong]:text-foreground">
        {children}
      </article>
    </div>
  );
}
