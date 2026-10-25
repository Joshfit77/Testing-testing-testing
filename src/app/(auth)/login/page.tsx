import Link from "next/link";
import { SignInForm } from "@/components/auth/auth-forms";
import { DeviceCleanup } from "@/components/platform/device-cleanup";
import { Notice } from "@/components/common/states";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="animate-fade-up pt-6">
      <h1 className="font-display text-4xl font-bold uppercase">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in to continue your training.</p>
      {sp.error && (
        <Notice tone="error" className="mt-4">
          {sp.error.slice(0, 200)}
        </Notice>
      )}
      {sp.notice && (
        <Notice tone="info" className="mt-4">
          {sp.notice.slice(0, 200)}
        </Notice>
      )}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <DeviceCleanup />
        <SignInForm next={safeNextPath(sp.next)} />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-gold-highlight hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
