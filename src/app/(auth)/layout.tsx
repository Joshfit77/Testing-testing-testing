import Link from "next/link";
import { Logo } from "@/components/common/logo";
import { SetupRequired } from "@/components/common/setup-required";
import { isSupabaseConfigured } from "@/lib/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupRequired />;
  return (
    <div className="hero-glow flex min-h-dvh flex-col">
      <header className="safe-top mx-auto flex h-20 w-full max-w-md items-center px-4">
        <Link href="/" aria-label="Narrow Gate Fitness home">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-16">{children}</main>
    </div>
  );
}
