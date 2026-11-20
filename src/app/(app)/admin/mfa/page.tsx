import { redirect } from "next/navigation";
import { AdminMfa } from "@/components/admin/admin-mfa";
import { getProfile, requireUser, sessionHasSecondFactor } from "@/server/auth";

export const metadata = { title: "Admin sign-in check" };
export const dynamic = "force-dynamic";

/**
 * The second step for administrators (F-8): enrol an authenticator app the first time, then enter its code each time
 * an admin signs in. Only admins get here; one already verified goes straight on to Admin.
 */
export default async function AdminMfaPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (profile?.role !== "admin") redirect("/home");
  if (await sessionHasSecondFactor()) redirect("/admin");
  return (
    <div className="mx-auto max-w-md space-y-4 pt-4">
      <h1 className="font-display text-3xl font-bold uppercase">Admin check</h1>
      <p className="text-sm text-muted-foreground">
        Admin tools need a second step: a code from an authenticator app (Apple Passwords, Google Authenticator, 1Password
        and similar). Your password alone opens only your own account.
      </p>
      <AdminMfa />
    </div>
  );
}
