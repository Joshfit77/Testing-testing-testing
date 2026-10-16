import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Tables containing the user's own rows (all readable by the user under RLS). */
const USER_TABLES: { table: string; column: string }[] = [
  { table: "profiles", column: "id" },
  { table: "onboarding_answers", column: "user_id" },
  { table: "fitness_goals", column: "user_id" },
  { table: "user_programs", column: "user_id" },
  { table: "training_programs", column: "owner_id" },
  { table: "workout_sessions", column: "user_id" },
  { table: "workout_exercises", column: "user_id" },
  { table: "workout_sets", column: "user_id" },
  { table: "personal_records", column: "user_id" },
  { table: "weight_entries", column: "user_id" },
  { table: "measurement_entries", column: "user_id" },
  { table: "recovery_checkins", column: "user_id" },
  { table: "foods", column: "owner_id" },
  { table: "meals", column: "user_id" },
  { table: "meal_items", column: "user_id" },
  { table: "nutrition_goals", column: "user_id" },
  { table: "water_entries", column: "user_id" },
  { table: "ai_conversations", column: "user_id" },
  { table: "ai_messages", column: "user_id" },
  { table: "ai_usage_events", column: "user_id" },
  { table: "faith_journal_entries", column: "user_id" },
  { table: "discipline_goals", column: "user_id" },
  { table: "discipline_checkins", column: "user_id" },
  { table: "subscriptions", column: "user_id" },
  { table: "user_entitlements", column: "user_id" },
];

export async function exportUserData(supabase: SupabaseClient, userId: string, email: string | undefined) {
  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    format: "narrow-gate-fitness/export@1",
    account: { id: userId, email },
  };
  for (const { table, column } of USER_TABLES) {
    const rows: unknown[] = [];
    // Page through large tables.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select("*").eq(column, userId).range(from, from + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    out[table] = rows;
  }
  return out;
}
