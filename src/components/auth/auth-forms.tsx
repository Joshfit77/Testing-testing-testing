"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import {
  requestPasswordResetAction,
  resendConfirmationAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/server/actions/auth";

function PasswordInput({ id, name, autoComplete, invalid, describedBy }: { id: string; name: string; autoComplete: string; invalid?: boolean; describedBy?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required aria-invalid={invalid} aria-describedby={describedBy} className="pr-12" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInAction, initialActionState);
  const [resendState, resendAction] = useActionState(resendConfirmationAction, initialActionState);
  const [email, setEmail] = useState("");
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next ?? "/home"} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(state.fieldErrors?.email)} aria-describedby="email-error" />
          <FieldError id="email-error" message={state.fieldErrors?.email} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-gold-highlight hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" name="password" autoComplete="current-password" invalid={Boolean(state.fieldErrors?.password)} describedBy="password-error" />
          <FieldError id="password-error" message={state.fieldErrors?.password} />
        </div>
        <FormMessage state={state} />
        <SubmitButton className="w-full" pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>
      {state.fieldErrors?.unconfirmed && (
        <form action={resendAction} className="space-y-2 rounded-xl border border-border bg-elevated p-3">
          <input type="hidden" name="email" value={email} />
          <SubmitButton variant="secondary" className="w-full" pendingLabel="Sending…">
            Resend confirmation email
          </SubmitButton>
          <FormMessage state={resendState} />
        </form>
      )}
    </div>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, initialActionState);
  if (state.ok) {
    return (
      <div role="status" className="rounded-2xl border border-success/50 bg-success/10 p-5 text-sm">
        <p className="font-semibold text-foreground">Almost there!</p>
        <p className="mt-1 text-muted-foreground">{state.message}</p>
        <Link href="/login" className="mt-4 inline-block font-semibold text-gold-highlight hover:underline">
          Go to sign in →
        </Link>
      </div>
    );
  }
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="displayName">Name</Label>
        <Input id="displayName" name="displayName" autoComplete="given-name" required maxLength={60} aria-invalid={Boolean(fe.displayName)} aria-describedby="name-error" />
        <FieldError id="name-error" message={fe.displayName} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(fe.email)} aria-describedby="email-error" />
        <FieldError id="email-error" message={fe.email} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" invalid={Boolean(fe.password)} describedBy="password-hint password-error" />
        <p id="password-hint" className="text-xs text-muted-foreground">
          At least 8 characters, including a letter and a number.
        </p>
        <FieldError id="password-error" message={fe.password} />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="ageConfirmed" className="mt-0.5 size-5 accent-[#C9A54C]" aria-describedby="age-error" />
        <span>I confirm I am 18 years of age or older.</span>
      </label>
      <FieldError id="age-error" message={fe.ageConfirmed} />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="termsAccepted" className="mt-0.5 size-5 accent-[#C9A54C]" aria-describedby="terms-error" />
        <span>
          I agree to the{" "}
          <Link href="/legal/terms" className="text-gold-highlight underline" target="_blank">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="text-gold-highlight underline" target="_blank">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <FieldError id="terms-error" message={fe.termsAccepted} />
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, initialActionState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(state.fieldErrors?.email)} />
        <FieldError message={state.fieldErrors?.email} />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, initialActionState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" invalid={Boolean(state.fieldErrors?.password)} />
        <FieldError message={state.fieldErrors?.password} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" invalid={Boolean(state.fieldErrors?.confirm)} />
        <FieldError message={state.fieldErrors?.confirm} />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
