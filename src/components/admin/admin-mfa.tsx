"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Factor } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Step = { kind: "loading" } | { kind: "verify"; factorId: string } | { kind: "enroll"; factorId: string; qr: string; secret: string } | { kind: "error"; message: string };

/**
 * The admin's second step, with Supabase Auth's TOTP factors (F-8). First time: a new authenticator is enrolled (QR
 * code, or the key typed in by hand) and confirmed with one code. After that: the code from the app. Either way the
 * session becomes aal2, which the server (requireAdmin) and the database (is_admin) both require for admin work.
 */
export function AdminMfa() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = getBrowserSupabase();
      const { data, error: listErr } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (listErr) {
        setStep({ kind: "error", message: "Couldn't check your sign-in methods. Reload the page to try again." });
        return;
      }
      const verified = data.totp.find((f: Factor) => f.status === "verified");
      if (verified) {
        setStep({ kind: "verify", factorId: verified.id });
        return;
      }
      // An enrolment started earlier and never confirmed is replaced (its key may never have reached an app).
      for (const f of data.all.filter((x: Factor) => x.factor_type === "totp" && x.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: enrolled, error: enrollErr } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Narrow Gate admin ${new Date().toISOString().slice(0, 10)}` });
      if (cancelled) return;
      if (enrollErr || !enrolled) {
        setStep({ kind: "error", message: "Couldn't start setting up the authenticator. Reload the page to try again." });
        return;
      }
      setStep({ kind: "enroll", factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step.kind !== "verify" && step.kind !== "enroll") return;
    setBusy(true);
    setError(null);
    const { error: vErr } = await getBrowserSupabase().auth.mfa.challengeAndVerify({ factorId: step.factorId, code: code.replace(/\s+/g, "") });
    setBusy(false);
    if (vErr) {
      setError("That code didn't work. Check the time on your phone and enter the current code.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  };

  if (step.kind === "loading") return <p className="text-sm text-muted-foreground">Checking…</p>;
  if (step.kind === "error") return <Notice tone="error">{step.message}</Notice>;
  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-5" data-testid={`admin-mfa-${step.kind}`}>
      {step.kind === "enroll" ? (
        <>
          <p className="text-sm">
            <strong>Set up your authenticator.</strong> Scan this code with your authenticator app, or type the key in by hand.
            Then enter the 6-digit code it shows.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: SVG from Supabase, not a site image */}
          <img src={step.qr} alt="QR code for your authenticator app" className="mx-auto size-44 rounded-lg bg-white p-2" />
          <p className="break-all text-center font-mono text-sm" data-testid="admin-mfa-secret">
            {step.secret}
          </p>
          <Notice tone="warning">
            Keep this phone (or add the same key to a second device as a backup). If you lose it, the owner of the Supabase
            project removes the authenticator and you set up a new one (docs/security/ADMIN_MFA.md).
          </Notice>
        </>
      ) : (
        <p className="text-sm">Enter the 6-digit code from your authenticator app.</p>
      )}
      <div className="space-y-2">
        <Label htmlFor="mfa-code">Code</Label>
        <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" className="w-full" disabled={busy || code.replace(/\s+/g, "").length < 6}>
        {busy ? "Checking…" : "Continue to Admin"}
      </Button>
    </form>
  );
}
