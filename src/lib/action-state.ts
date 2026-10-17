import type { z } from "zod";
import { fieldErrors } from "@/lib/validation/schemas";

export interface ActionState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Changes on every submission so clients can react to repeated identical results. */
  at?: number;
}

export const initialActionState: ActionState = { ok: false };

export const actionOk = (message?: string): ActionState => ({ ok: true, message, at: Date.now() });
export const actionError = (message: string, errors?: Record<string, string>): ActionState => ({
  ok: false,
  message,
  fieldErrors: errors,
  at: Date.now(),
});
export const actionInvalid = (error: z.ZodError): ActionState =>
  actionError("Please fix the highlighted fields.", fieldErrors(error));
