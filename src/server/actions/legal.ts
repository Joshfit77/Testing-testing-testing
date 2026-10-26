"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { actionError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/server/auth";
import { currentReacceptRows, recordAcceptances } from "@/server/legal";
import { logError } from "@/server/log";

const schema = z.object({
  termsAccepted: z.literal("on", { message: "Please accept the Terms of Service and Privacy Policy" }),
  riskAcknowledged: z.literal("on", { message: "Please read and acknowledge the health and AI notice" }),
});

/** Accept the current Terms, Privacy Policy and health & AI notice after a change (both boxes start unticked). */
export async function acceptCurrentTermsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Please tick both boxes.");
  try {
    await recordAcceptances(user.id, currentReacceptRows(), "reaccept");
  } catch (err) {
    logError("legal.accept", err);
    return actionError("We couldn't save that. Please try again.");
  }
  redirect("/home");
}
