import Link from "next/link";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="hero-glow flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />
      <h1 className="mt-8 font-display text-5xl font-bold uppercase">Not found</h1>
      <p className="mt-2 text-muted-foreground">This page took the wide road. Let&apos;s get you back.</p>
      <Button asChild className="mt-6">
        <Link href="/home">Go home</Link>
      </Button>
    </main>
  );
}
