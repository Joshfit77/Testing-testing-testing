// Occasional member for the UX audit: the sample history trimmed to a sparse last week. LOCAL demo database only.
//   npx tsx --conditions=react-server <this file>   (env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { seedSampleData, seedSampleProfile, setSeedClient } from "../../src/server/demo-seed";
import { signupAcceptances } from "../../src/lib/legal/versions";

async function main() {
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL)) throw new Error("local database only");
const db = createClient(URL, KEY, { auth: { persistSession: false } });
setSeedClient(db);
const EMAIL = "occasional.member@demo.narrowgate.local";
const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
for (const u of list.users.filter((u) => u.email === EMAIL)) await db.auth.admin.deleteUser(u.id);
const password = `${randomBytes(18).toString("base64url")}aZ9`;
const { data, error } = await db.auth.admin.createUser({ email: EMAIL, password, email_confirm: true, app_metadata: { demo: true }, user_metadata: { display_name: "Sam", legal_acceptances: signupAcceptances() } });
if (error) throw error;
const id = data.user.id;
await seedSampleProfile(id);
await db.from("profiles").update({ display_name: "Sam" }).eq("id", id);
await seedSampleData(id);
const day = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();
const date = (n: number) => day(n).slice(0, 10);
// Keep one sparse week: drop everything older than 7 days.
const cut: [string, string, string][] = [
  ["workout_sessions", "started_at", day(7)], ["activities", "started_at", day(7)], ["meals", "eaten_on", date(7)], ["sleep_sessions", "night_of", date(7)],
  ["bible_reading_history", "read_on", date(7)], ["faith_journal_entries", "entry_date", date(7)], ["water_entries", "recorded_on", date(7)], ["daily_steps", "day", date(7)],
  ["measurement_entries", "recorded_on", date(7)], ["discipline_checkins", "checked_on", date(7)], ["personal_records", "achieved_at", day(7)],
];
for (const [t, c, v] of cut) { const { error } = await db.from(t).delete().eq("user_id", id).lt(c, v); if (error) console.log(`trim ${t}: ${error.message}`); }
// Sparse inside the week: keep 2 workouts, meals on 2 days, 1 run, 3 nights, 2 readings.
const keep = async (t: string, order: string, n: number) => {
  const { data } = await db.from(t).select("id").eq("user_id", id).order(order, { ascending: false });
  const drop = (data ?? []).filter((_, i) => i % Math.max(1, Math.ceil((data ?? []).length / n)) !== 0).map((r) => r.id);
  if (drop.length) await db.from(t).delete().in("id", drop);
};
await keep("workout_sessions", "started_at", 2); await keep("activities", "started_at", 1); await keep("sleep_sessions", "night_of", 3); await keep("bible_reading_history", "read_on", 2);
const { data: mealDays } = await db.from("meals").select("eaten_on").eq("user_id", id);
const days = [...new Set((mealDays ?? []).map((m) => m.eaten_on))].sort().reverse();
if (days.length > 2) await db.from("meals").delete().eq("user_id", id).in("eaten_on", days.filter((_, i) => i !== 1 && i !== 4));
await db.from("meals").delete().eq("user_id", id).eq("eaten_on", date(0));
const counts: Record<string, number> = {};
for (const t of ["workout_sessions", "activities", "meals", "sleep_sessions", "bible_reading_history", "faith_journal_entries"]) counts[t] = (await db.from(t).select("id", { count: "exact", head: true }).eq("user_id", id)).count ?? 0;
writeFileSync(process.argv[2] ?? "occasional.env", `OCC_EMAIL=${EMAIL}\nOCC_PASSWORD=${password}\n`, { mode: 0o600 });
console.log("occasional member", JSON.stringify(counts));

}
main().catch((e) => { console.error(e); process.exit(1); });
