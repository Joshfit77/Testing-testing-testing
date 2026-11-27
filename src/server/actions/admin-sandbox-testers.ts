"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase/server";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/server/auth";
import { isServiceRoleConfigured, serverEnv } from "@/server/env";
import { logError } from "@/server/log";
import { recomputeEntitlement } from "@/server/services/billing";
import { addSandboxTester, removeSandboxTester, resolveAccount } from "@/server/services/sandbox-testers";
import { syncStoreSubscriber } from "@/server/services/store-billing";

/**
 * Sandbox tester allow-list (admin Subscriptions page). Adding or removing someone re-reads their store purchases at
 * once, so a sandbox purchase they already made starts or stops counting without waiting for the next renewal.
 */

const addSchema = z.object({
  account: z.string().trim().min(3).max(320),
  note: z.string().trim().min(1, "Say who this is and why (e.g. App Review demo account).").max(200),
  expiresOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
});

async function refreshPlan(userId: string) {
  try {
    if (serverEnv.revenueCatSecretKey) await syncStoreSubscriber(userId);
    else await recomputeEntitlement(userId);
  } catch (err) {
    // The list change itself stands; the plan catches up on the member's next sync.
    logError("admin.sandbox_testers.refresh", err);
  }
}

async function audit(actorId: string, action: string, userId: string, details: Record<string, unknown>) {
  const { error } = await getServiceSupabase().from("admin_audit_logs").insert({ actor_id: actorId, action, entity_type: "sandbox_tester", entity_id: userId, details });
  if (error) logError("admin.audit", error);
}

export async function addSandboxTesterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireAdmin();
  if (!isServiceRoleConfigured()) return actionError("SUPABASE_SERVICE_ROLE_KEY is required.");
  const parsed = addSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Check the form.");
  const userId = await resolveAccount(parsed.data.account);
  if (!userId) return actionError("No account with that email or user id.");
  // End of the chosen day, UTC.
  const expiresAt = parsed.data.expiresOn ? new Date(`${parsed.data.expiresOn}T23:59:59Z`).toISOString() : null;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return actionError("The end date is in the past.");
  await addSandboxTester({ userId, note: parsed.data.note, expiresAt, addedBy: user.id });
  await audit(user.id, "sandbox_tester.add", userId, { note: parsed.data.note, expires_at: expiresAt });
  await refreshPlan(userId);
  revalidatePath("/admin/subscriptions");
  return actionOk("Added. Sandbox purchases on that account now count.");
}

export async function removeSandboxTesterAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const userId = z.string().uuid().safeParse(formData.get("userId"));
  if (!userId.success || !isServiceRoleConfigured()) return;
  await removeSandboxTester(userId.data);
  await audit(user.id, "sandbox_tester.remove", userId.data, {});
  await refreshPlan(userId.data);
  revalidatePath("/admin/subscriptions");
}
